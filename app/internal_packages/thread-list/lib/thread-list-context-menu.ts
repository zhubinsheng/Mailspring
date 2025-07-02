/* eslint global-require: 0*/
import _ from 'underscore';
import {
  localized,
  Thread,
  Actions,
  Message,
  TaskFactory,
  DatabaseStore,
  FocusedPerspectiveStore,
  Task,
} from 'mailspring-exports';
import DatabaseObjectRegistry from '../../../src/registries/database-object-registry';
import * as Attributes from '../../../src/flux/attributes';

type TemplateItem =
  | {
    label: string;
    click: () => void;
  }
  | { type: 'separator' };

// 定义并注册 InsertAiMessageTask
class InsertAiMessageTask extends Task {
  static modelName = 'InsertAiMessageTask';
  static attributes = {
    ...Task.attributes,
    payload: Attributes.Object({ modelKey: 'payload' }),
  };
  constructor(data: any = {}) {
    super(data);
  }
}
DatabaseObjectRegistry.register('InsertAiMessageTask', () => InsertAiMessageTask);

// 定义并注册 UpdateAiMessageTask
class UpdateAiMessageTask extends Task {
  static modelName = 'UpdateAiMessageTask';
  static attributes = {
    ...Task.attributes,
    id: Attributes.String({ modelKey: 'id' }),
    content: Attributes.String({ modelKey: 'content' }),
    isUnread: Attributes.Number({ modelKey: 'isUnread' }),
  };
  id: string;
  content: string;
  isUnread: number;
  constructor(data: any = {}) {
    super(data);
    this.id = data.id;
    this.content = data.content;
    this.isUnread = data.isUnread;
    this.accountId = data.accountId;
    this.source = data.source;
  }
}
DatabaseObjectRegistry.register('UpdateAiMessageTask', () => UpdateAiMessageTask);

// 定义并注册 DeleteAiMessageTask
class DeleteAiMessageTask extends Task {
  static modelName = 'DeleteAiMessageTask';
  static attributes = {
    ...Task.attributes,
    id: Attributes.String({ modelKey: 'id' }),
  };
  id: string;
  constructor(data: any = {}) {
    super(data);
    this.id = data.id;
    this.accountId = data.accountId;
    this.source = data.source;
  }
}
DatabaseObjectRegistry.register('DeleteAiMessageTask', () => DeleteAiMessageTask);

// 定义并注册 InsertAiChatSessionTask
class InsertAiChatSessionTask extends Task {
  static modelName = 'InsertAiChatSessionTask';
  static attributes = {
    ...Task.attributes,
    userId: Attributes.String({ modelKey: 'userId' }),
    title: Attributes.String({ modelKey: 'title' }),
  };
  userId: string;
  title: string;
  constructor(data: any = {}) {
    super(data);
    this.userId = data.userId;
    this.title = data.title;
    this.accountId = data.accountId;
    this.source = data.source;
  }
}
DatabaseObjectRegistry.register('InsertAiChatSessionTask', () => InsertAiChatSessionTask);

// 定义并注册 UpdateAiChatSessionTask
class UpdateAiChatSessionTask extends Task {
  static modelName = 'UpdateAiChatSessionTask';
  static attributes = {
    ...Task.attributes,
    id: Attributes.String({ modelKey: 'id' }),
    title: Attributes.String({ modelKey: 'title' }),
  };
  id: string;
  title: string;
  constructor(data: any = {}) {
    super(data);
    this.id = data.id;
    this.title = data.title;
    this.accountId = data.accountId;
    this.source = data.source;
  }
}
DatabaseObjectRegistry.register('UpdateAiChatSessionTask', () => UpdateAiChatSessionTask);

// 定义并注册 DeleteAiChatSessionTask
class DeleteAiChatSessionTask extends Task {
  static modelName = 'DeleteAiChatSessionTask';
  static attributes = {
    ...Task.attributes,
    id: Attributes.String({ modelKey: 'id' }),
  };
  id: string;
  constructor(data: any = {}) {
    super(data);
    this.id = data.id;
    this.accountId = data.accountId;
    this.source = data.source;
  }
}
DatabaseObjectRegistry.register('DeleteAiChatSessionTask', () => DeleteAiChatSessionTask);

export default class ThreadListContextMenu {
  threadIds: string[];
  accountIds: string[];
  threads?: Thread[];
  data: any;

  constructor({ threadIds = [], accountIds = [] }) {
    this.threadIds = threadIds;
    this.accountIds = accountIds;
  }

  menuItemTemplate() {
    return DatabaseStore.modelify<Thread>(Thread, this.threadIds)
      .then(threads => {
        this.threads = threads;

        return Promise.all<TemplateItem>([
          this.findWithFrom(),
          this.findWithSubject(),
          { type: 'separator' },
          this.replyItem(),
          this.replyAllItem(),
          this.forwardItem(),
          { type: 'separator' },
          this.archiveItem(),
          this.trashItem(),
          this.markAsReadItem(),
          this.markAsSpamItem(),
          this.starItem(),
          { type: 'separator' },
          this.createMailboxLinkItem(),
          // AI Chat Test Buttons
          {
            label: '测试AI消息插入',
            click: () => {
              const task = new InsertAiMessageTask({
                accountId: this.accountIds[0],
                payload: {
                  sessionId: 'test-session-id',
                  role: 'user',
                  content: '这是一条AI测试消息',
                  isUnread: 1,
                },
                source: 'ThreadListContextMenuTest',
              });
              Actions.queueTask(task);
            },
          },
          {
            label: '测试AI消息更新',
            click: () => {
              const task = new UpdateAiMessageTask({
                accountId: this.accountIds[0],
                payload: {
                  id: 'local-c0fa93ac-018a',
                  content: 'AI消息已更新',
                  isUnread: 0,
                },
                source: 'ThreadListContextMenuTest',
              });
              Actions.queueTask(task);
            },
          },
          {
            label: '测试AI消息删除',
            click: () => {
              const task = new DeleteAiMessageTask({
                accountId: this.accountIds[0],
                payload: {
                  id: 'test-msg-id',
                },
                source: 'ThreadListContextMenuTest',
              });
              Actions.queueTask(task);
            },
          },
          // AI ChatSession Test Buttons
          {
            label: '测试AI会话插入',
            click: () => {
              const task = new InsertAiChatSessionTask({
                accountId: this.accountIds[0],
                payload: {
                  userId: 'test-user-id',
                  title: '测试会话',
                },
                source: 'ThreadListContextMenuTest',
              });
              Actions.queueTask(task);
            },
          },
          {
            label: '测试AI会话更新',
            click: () => {
              const task = new UpdateAiChatSessionTask({
                accountId: this.accountIds[0],
                payload: {
                  id: '4myKRzLykB7vG143FNLqESeA5szg3gbTqxt8W4u7',
                  title: '会话标题已更新',
                },
                source: 'ThreadListContextMenuTest',
              });
              Actions.queueTask(task);
            },
          },
          {
            label: '测试AI会话删除',
            click: () => {
              const task = new DeleteAiChatSessionTask({
                accountId: this.accountIds[0],
                payload: {
                  id: 'test-session-id',
                },
                source: 'ThreadListContextMenuTest',
              });
              Actions.queueTask(task);
            },
          },
        ]);
      })
      .then(menuItems => {
        return _.filter(_.compact(menuItems), (item, index) => {
          if (
            (index === 0 || index === menuItems.length - 1) &&
            (item as any).type === 'separator'
          ) {
            return false;
          }
          return true;
        });
      });
  }

  findWithFrom(): TemplateItem | null {
    if (this.threadIds.length !== 1 || !this.threads[0]) {
      return null;
    }
    const first = this.threads[0];
    const from = first.participants.find(p => !p.isMe()) || first.participants[0];

    return {
      label: localized(`Search for`) + ' ' + from.email,
      click: () => {
        Actions.searchQuerySubmitted(`"${from.email.replace('"', '""')}"`);
      },
    };
  }

  findWithSubject(): TemplateItem | null {
    if (this.threadIds.length !== 1 || !this.threads[0]) {
      return null;
    }
    const subject = this.threads[0].subject;

    return {
      label:
        localized(`Search for`) +
        ' ' +
        (subject.length > 35 ? `${subject.substr(0, 35)}...` : subject),
      click: () => {
        Actions.searchQuerySubmitted(`subject:"${subject}"`);
      },
    };
  }

  replyItem(): TemplateItem | null {
    if (this.threadIds.length !== 1 || !this.threads[0]) {
      return null;
    }
    return {
      label: localized('Reply'),
      click: () => {
        Actions.composeReply({
          threadId: this.threadIds[0],
          popout: true,
          type: 'reply',
          behavior: 'prefer-existing-if-pristine',
        });
      },
    };
  }

  replyAllItem(): Promise<TemplateItem> | null {
    if (this.threadIds.length !== 1 || !this.threads[0]) {
      return null;
    }

    return DatabaseStore.findBy<Message>(Message, { threadId: this.threadIds[0] })
      .order(Message.attributes.date.descending())
      .limit(1)
      .then(message => {
        if (message && message.canReplyAll()) {
          return {
            label: localized('Reply All'),
            click: () => {
              Actions.composeReply({
                threadId: this.threadIds[0],
                popout: true,
                type: 'reply-all',
                behavior: 'prefer-existing-if-pristine',
              });
            },
          };
        }
        return null;
      });
  }

  forwardItem(): TemplateItem | null {
    if (this.threadIds.length !== 1 || !this.threads[0]) {
      return null;
    }
    return {
      label: localized('Forward'),
      click: () => {
        Actions.composeForward({ threadId: this.threadIds[0], popout: true });
      },
    };
  }

  archiveItem(): TemplateItem | null {
    const perspective = FocusedPerspectiveStore.current();
    const allowed = perspective.canArchiveThreads(this.threads);
    if (!allowed) {
      return null;
    }
    return {
      label: localized('Archive'),
      click: () => {
        const tasks = TaskFactory.tasksForArchiving({
          source: 'Context Menu: Thread List',
          threads: this.threads,
        });
        Actions.queueTasks(tasks);
      },
    };
  }

  trashItem(): TemplateItem | null {
    const perspective = FocusedPerspectiveStore.current();
    const allowed = perspective.canMoveThreadsTo(this.threads, 'trash');
    if (!allowed) {
      return null;
    }
    return {
      label: localized('Trash'),
      click: () => {
        const tasks = TaskFactory.tasksForMovingToTrash({
          source: 'Context Menu: Thread List',
          threads: this.threads,
        });
        Actions.queueTasks(tasks);
      },
    };
  }

  markAsReadItem(): TemplateItem | null {
    const unread = this.threads.every(t => t.unread === false);
    const dir = unread ? localized('Unread') : localized('Read');

    return {
      label: localized(`Mark as %@`, dir),
      click: () => {
        Actions.queueTask(
          TaskFactory.taskForInvertingUnread({
            source: 'Context Menu: Thread List',
            threads: this.threads,
          })
        );
      },
    };
  }

  markAsSpamItem(): TemplateItem | null {
    const allInSpam = this.threads.every(item => item.folders.some(c => c.role === 'spam'));
    const dir = allInSpam ? localized('Not Spam') : localized('Spam');

    return {
      label: localized(`Mark as %@`, dir),
      click: () => {
        Actions.queueTasks(
          allInSpam
            ? TaskFactory.tasksForMarkingNotSpam({
              source: 'Context Menu: Thread List',
              threads: this.threads,
            })
            : TaskFactory.tasksForMarkingAsSpam({
              source: 'Context Menu: Thread List',
              threads: this.threads,
            })
        );
      },
    };
  }

  starItem(): TemplateItem | null {
    const starred = this.threads.every(t => t.starred === false);

    let label = localized('Star');
    if (!starred) {
      label = this.threadIds.length > 1 ? localized('Remove Stars') : localized('Remove Star');
    }

    return {
      label: label,
      click: () => {
        Actions.queueTask(
          TaskFactory.taskForInvertingStarred({
            source: 'Context Menu: Thread List',
            threads: this.threads,
          })
        );
      },
    };
  }

  createMailboxLinkItem() {
    if (this.threadIds.length !== 1 || !this.threads[0]) {
      return null;
    }

    return {
      label: localized('Copy mailbox permalink'),
      click: async () => {
        const id = this.threadIds[0];
        const thread = await DatabaseStore.findBy<Thread>(Thread, { id }).limit(1);
        if (!thread) return;
        require('electron').clipboard.writeText(thread.getMailboxPermalink());
      },
    };
  }

  displayMenu() {
    this.menuItemTemplate().then(template => {
      require('@electron/remote').Menu.buildFromTemplate(template).popup({});
    });
  }
}
