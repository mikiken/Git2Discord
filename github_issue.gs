const DISCORD_WEBHOOK_URL = '<your discord webhook url>';
// GitHubのユーザー名とDiscordのUserIDの対応が書かれたスプレッドシートを指定
const SPREADSHEET_ID = '<your spreadsheet id>';
const SHEET_NAME = '<your sheet name>';

// Webhookを受け取る
function doPost(e) {
    e = JSON.parse(e.postData.getDataAsString());
    postWebhook(DISCORD_WEBHOOK_URL, formatJsonForDiscord(e));
}

// GitHubからのwebhookのJSONをDiscord用に整形する
function formatJsonForDiscord(jsonObject) {
    let issue_number = jsonObject.issue.number;
    let issue_url = `https://github.com/${jsonObject.repository.full_name}/issues/${issue_number}`;
    let author_with_link = `[${jsonObject.sender?.login}](https://github.com/${jsonObject.sender?.login})`;

    const action = jsonObject.action;
    let event_type = (function () {
        const keys = Object.keys(jsonObject);
        if (keys.includes('issue')) {
            if (keys.includes('comment')) {
                return 'issue_comment';
            } else {
                return 'issues';
            }
        }
    }());

    let message = (function () {
        switch (event_type) {
            case 'issues':
                return `Issue [#${issue_number}](${issue_url}) ${action}`;
            case 'issue_comment':
                if (action.includes('created'))
                    return `New comment on issue [#${issue_number}](${issue_url})`;
                return `Comment on issue [#${issue_number}](${issue_url}) ${action}`;
            default:
                break;
        }
    }());

    let embeds_title = (function () {
        switch (event_type) {
            case 'issues':
                return `**#${issue_number} ${jsonObject.issue.title}**`;
            case 'issue_comment':
                return `**Comment on #${issue_number} ${jsonObject.issue.title}**`;
            default:
                break;
        }
    }());

    let embeds_description = (function () {
        switch (event_type) {
            case 'issues':
                if (action.includes('closed'))
                    return ``;
                return replaceMentionForDiscord(`${jsonObject.issue.body}`);
            case 'issue_comment':
                return replaceMentionForDiscord(`${jsonObject.comment.body}`);
            default:
                break;
        }
    }());

    let embeds_url = (function () {
        switch (event_type) {
            case 'issues':
            case 'issue-close':
                return `${issue_url}`;
            case 'issue_comment':
                let comment_id = jsonObject.comment.url.split('/').pop();
                return `${issue_url}#issuecomment-${comment_id}`;
            default:
                break;
        }
    }());

    let embeds_color = (function () {
        if (action.includes('deleted'))
            return parseInt('c23535', 16);
        switch (event_type) {
            case 'issues':
                if (action.includes('closed'))
                    return parseInt('7e52e1', 16);
                return parseInt('4ca64c', 16);
            case 'issue_comment':
                return parseInt('25292f', 16);
            default:
                break;
        }
    })();

    return {
        username: "GitHub",
        avatar_url: "https://github.githubassets.com/assets/GitHub-Mark-ea2971cee799.png",
        content: `${message} by ${author_with_link}`,
        embeds: [
            {
                title: `${embeds_title}`,
                description: `${embeds_description}`,
                url: `${embeds_url}`,
                timestamp: `${jsonObject.issue.updated_at}`,
                color: embeds_color,
                footer: {
                    text: `${jsonObject.repository.full_name}`,
                    icon_url: "https://github.githubassets.com/assets/GitHub-Mark-ea2971cee799.png"
                },
            }
        ]
    };
}

// GitHubのメンションをDiscordのメンションに置換する
function replaceMentionForDiscord(message) {
    // スプレッドシートからユーザーの対応表を取得
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    const table = sheet.getDataRange().getValues();

    for (let i = 0; i < table.length; i++) {
        const githubUserName = table[i][0];
        const discordUserId = table[i][1];
        // メッセージにメンションを含む場合、DiscordのUserIDに置換
        if (message.includes("@" + githubUserName)) {
            message = message.replace(new RegExp("@" + githubUserName, 'g'), "<@" + discordUserId + ">");
        }
    }
    return message;
}

// 指定URLにwebhookを送信
function postWebhook(webhook_url, payload) {
    UrlFetchApp.fetch(webhook_url, {
        contentType: 'application/json',
        method: 'post',
        payload: JSON.stringify(payload)
    });
}
