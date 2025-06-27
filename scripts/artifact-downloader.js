const path = require('path');
const https = require('https');
const fs = require('fs');
const { execSync, exec } = require('child_process');
const targz = require('targz');

function getGithubMailsyncURL(callback) {
    console.log('[artifact] 开始获取 mailsync 子模块信息...');
    const distKey = `${process.platform}-${process.arch}`;
    const distDir = {
        'darwin-x64': 'macOS',
        'darwin-arm64': 'macOS',
        'win32-x64': 'Windows',
        'win32-ia32': 'Windows',
        'linux-x64': 'Linux',
        'linux-ia32': null,
    }[distKey];

    if (!distDir) {
        console.error(
            `Sorry, a Mailspring Mailsync build for your machine (${distKey}) is not yet available.`
        );
        return;
    }

    // 获取 owner/repo
    let owner, repo;
    try {
        const submoduleUrl = execSync('git config --file .gitmodules --get submodule.mailsync.url').toString().trim();
        // 更健壮的正则，兼容 .git、末尾/、大小写、repo 名含点
        const match = submoduleUrl.match(/github\.com[:\/]([^\/]+)\/([^\/]+?)(?:\.git)?\/?$/i);
        console.log('[artifact] submodule url match:', match);
        if (match) {
            owner = match[1];
            repo = match[2].replace(/\.git$/i, '');
            console.log('[artifact] submodule owner:', owner);
            console.log('[artifact] submodule repo:', repo);
        } else {
            console.error('[artifact] submodule url 解析失败，原始内容:', submoduleUrl);
        }
    } catch (e) {
        console.error('[artifact] 获取 submodule url 失败:', e);
    }

    // 获取 commitId
    const out = execSync('git submodule status ./mailsync');
    console.log('[git submodule status ./mailsync] :', out.toString());
    const match = /^[\s\+-]*([a-f0-9]{40})/i.exec(out.toString());
    if (!match) {
        console.error('[artifact] 无法从 submodule status 获取 commit id，原始内容:', out.toString());
        process.exit(1);
    }
    const hash = match[1];

    console.log(`[artifact] mailsync 信息: owner=${owner}, repo=${repo}, commitId=${hash}, distDir=${distDir}`);
    callback({ owner, repo, commitId: hash, distDir });
}

function getWorkflowRunIdByCommit(owner, repo, commitId, callback, page = 1) {
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const options = {
        hostname: 'api.github.com',
        path: `/repos/${owner}/${repo}/actions/runs?per_page=100&page=${page}`,
        headers: {
            'User-Agent': 'node.js',
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github+json'
        }
    };
    console.log(`[artifact] 查询 workflow run: owner=${owner}, repo=${repo}, commitId=${commitId}, page=${page}`);
    https.get(options, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            const runs = JSON.parse(data).workflow_runs;
            const run = runs.find(r => r.head_sha.startsWith(commitId));
            if (run) {
                console.log(`[artifact] 找到 workflow runId: ${run.id}`);
                callback(run.id);
            } else if (runs.length === 100) {
                // 还有下一页
                getWorkflowRunIdByCommit(owner, repo, commitId, callback, page + 1);
            } else {
                console.error('[artifact] 没有找到包含该 commit 的 workflow run');
                throw new Error('No workflow run for commit');
            }
        });
    });
}

function getArtifactDownloadUrl(owner, repo, runId, artifactName, callback) {
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const options = {
        hostname: 'api.github.com',
        path: `/repos/${owner}/${repo}/actions/runs/${runId}/artifacts`,
        headers: {
            'User-Agent': 'node.js',
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github+json'
        }
    };
    console.log(`[artifact] 查询 artifact: owner=${owner}, repo=${repo}, runId=${runId}, artifactName=${artifactName}`);
    https.get(options, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            const artifacts = JSON.parse(data).artifacts;
            console.log(artifacts);
            // 更健壮的匹配，允许 artifactName 前后有后缀、大小写不同
            const artifact = artifacts.find(a =>
                a.name.toLowerCase() === artifactName.toLowerCase() ||
                a.name.toLowerCase().startsWith(artifactName.toLowerCase()) ||
                new RegExp(artifactName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(a.name)
            );
            if (!artifact) {
                console.error(`[artifact] 没有找到 artifact: ${artifactName}，可用:`, artifacts.map(a => a.name));
                throw new Error('No artifact found');
            }
            console.log(`[artifact] 找到 artifact downloadUrl: ${artifact.archive_download_url}`);
            callback(artifact.archive_download_url);
        });
    });
}

function downloadArtifact(url, dest, callback, withAuth = true) {
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const options = {
        headers: {
            'User-Agent': 'node.js',
            'Accept': 'application/vnd.github+json'
        }
    };
    if (withAuth && GITHUB_TOKEN) {
        options.headers['Authorization'] = `token ${GITHUB_TOKEN}`;
    }
    console.log(`[artifact] 开始下载 artifact: ${url} -> ${dest} (withAuth=${withAuth})`);
    https.get(url, options, res => {
        if (res.statusCode === 302 && res.headers.location) {
            console.log(`[artifact] 遇到 302 跳转，自动跟随到: ${res.headers.location}`);
            // 跳转后不再带 Authorization
            downloadArtifact(res.headers.location, dest, callback, false);
            return;
        }
        if (res.statusCode !== 200) {
            let errorData = '';
            res.on('data', chunk => errorData += chunk);
            res.on('end', () => {
                console.error(`[artifact] 下载失败，HTTP 状态码: ${res.statusCode}`);
                console.error(`[artifact] 响应内容: ${errorData}`);
                if (res.statusCode === 403 && errorData.includes('actions scope')) {
                    console.error('[artifact] 你的 GITHUB_TOKEN 没有 actions 权限，请生成带 actions scope 的 token 并设置为 GITHUB_TOKEN 环境变量。');
                }
                if (typeof callback === 'function') callback(new Error('Download failed'));
            });
            return;
        }
        const total = parseInt(res.headers['content-length'], 10) || 0;
        let downloaded = 0;
        let lastPercent = -1;
        const file = fs.createWriteStream(dest);
        res.on('data', chunk => {
            downloaded += chunk.length;
            if (total) {
                const percent = Math.floor((downloaded / total) * 100);
                if (percent !== lastPercent && percent % 1 === 0) { // 每1%显示一次
                    process.stdout.write(`\r[artifact] 下载进度: ${percent}% (${downloaded}/${total} bytes)`);
                    lastPercent = percent;
                }
            } else {
                process.stdout.write(`\r[artifact] 已下载: ${downloaded} bytes`);
            }
        });
        res.pipe(file);
        file.on('finish', () => {
            file.close(() => {
                process.stdout.write('\n');
                console.log(`[artifact] 下载完成: ${dest}`);
                if (typeof callback === 'function') callback();
            });
        });
    }).on('error', err => {
        console.error(`[artifact] 下载请求出错: ${err}`);
        if (typeof callback === 'function') callback(err);
    });
}

function downloadMailsyncFromArtifact({ owner, repo, commitId, distDir }, done) {
    const artifactName = `mailsync-${commitId}-${distDir}`;
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    if (!GITHUB_TOKEN) {
        console.error('[artifact] GITHUB_TOKEN 环境变量未设置，无法下载 artifact。');
        process.exit(1);
    }
    console.log(`[artifact] 开始下载 mailsync artifact: owner=${owner}, repo=${repo}, commitId=${commitId}, distDir=${distDir}`);
    getWorkflowRunIdByCommit(owner, repo, commitId, runId => {
        getArtifactDownloadUrl(owner, repo, runId, artifactName, downloadUrl => {
            downloadArtifact(downloadUrl, 'app/mailsync.tar.gz', () => {
                console.log('[artifact] mailsync artifact 下载流程完成!');
                // 解压等后续操作
                if (typeof done === 'function') done();
            });
        });
    });
}

function isGzipFile(filePath) {
    try {
        const fd = fs.openSync(filePath, 'r');
        const buffer = Buffer.alloc(2);
        fs.readSync(fd, buffer, 0, 2, 0);
        fs.closeSync(fd);
        // Gzip magic number: 1F 8B
        return buffer[0] === 0x1f && buffer[1] === 0x8b;
    } catch (e) {
        return false;
    }
}

function isZipFile(filePath) {
    try {
        const fd = fs.openSync(filePath, 'r');
        const buffer = Buffer.alloc(4);
        fs.readSync(fd, buffer, 0, 4, 0);
        fs.closeSync(fd);
        // ZIP magic number: PK\x03\x04
        return buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
    } catch (e) {
        return false;
    }
}

function extractTarGzIfExists(tarGzPath, dest, done) {
    if (fs.existsSync(tarGzPath) && isGzipFile(tarGzPath)) {
        targz.decompress(
            { src: tarGzPath, dest },
            err => {
                if (!err) {
                    console.log(`Unpackaged Mailsync into ${dest}`);
                } else {
                    console.error(`Encountered an error unpacking: ${err}`);
                }
                if (typeof done === 'function') done(err);
            }
        );
    } else {
        if (typeof done === 'function') done();
    }
}

function downloadAndExtractMailsyncArtifact(info, done) {
    downloadMailsyncFromArtifact(info, () => {
        console.log('[artifact] mailsync artifact 下载流程全部完成!');
        const zipPath = 'app/mailsync.tar.gz';
        // 先判断并解压 zip
        if (isZipFile(zipPath)) {
            console.log(`isZipFile. 使用系统 unzip 解压...`);
            exec(`unzip -o ${zipPath} -d app/`, (err, stdout, stderr) => {
                if (err) {
                    console.error('Encountered an error unzipping:', err, stderr);
                    if (typeof done === 'function') done(err);
                } else {
                    console.log('Unzipped mailsync artifact into ./app.');
                    // 解压后查找 app/ 目录下的 tar.gz 文件
                    extractTarGzIfExists('app/mailsync.tar.gz', 'app/', done);
                }
            });
            return;
        }
        // 再判断并解压 tar.gz
        if (isGzipFile(zipPath)) {
            extractTarGzIfExists(zipPath, 'app/', done);
            return;
        }
        // 都不是则报错
        let content;
        try {
            content = fs.readFileSync(zipPath, { encoding: 'utf8', flag: 'r' });
        } catch (e) {
            content = '[无法读取文件内容]';
        }
        console.error('[artifact] 下载的文件不是有效的 zip 或 gzip 文件，前200字节内容如下：\n', content.slice(0, 200));
        if (typeof done === 'function') done(new Error('Downloaded file is not a valid zip or gzip file'));
    });
}

module.exports = {
    getGithubMailsyncURL,
    downloadMailsyncFromArtifact,
    downloadAndExtractMailsyncArtifact
};

// 测试方法：本地直接 node scripts/artifact-downloader.js 可触发
if (require.main === module) {
    console.log('[artifact] 测试 mailsync artifact 下载流程...');
    getGithubMailsyncURL((info) => {
        if (!info.owner || !info.repo || !info.commitId || !info.distDir) {
            console.error('[artifact] 测试失败：mailsync 信息不完整', info);
            process.exit(1);
        }
        downloadAndExtractMailsyncArtifact(info, (err) => {
            if (err) {
                console.error('[artifact] 测试失败：', err);
            } else {
                console.log('[artifact] 测试流程全部完成！');
            }
        });
    });
} 