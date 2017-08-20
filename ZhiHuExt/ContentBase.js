"use strict"

function _getAnsVoters(ansId, offset)
{
    const pms = $.Deferred();
    ContentBase._get("https://www.zhihu.com/api/v4/answers/" + ansId + "/voters?include=data[*].answer_count&limit=20&offset=" + offset)
        .done((data, status, xhr) =>
        {
            const users = data.data.map(User.fromRawJson2);
            pms.resolve({ "users": users, "end": data.paging.is_end, "start": data.paging.is_start, "total": data.paging.totals });
        })
        .fail((data, status, xhr) =>
        {
            if (data.responseJSON)
                console.warn("getAnsVoter fail:" + xhr.status, data.responseJSON.error.message);
            else
                console.warn("getAnsVoter fail:" + xhr.status);
            pms.reject();
        })
    return pms;
}

let _CUR_USER;
let _CUR_ANSWER;
class ContentBase
{
    static get CUR_USER() { return _CUR_USER; }
    static set CUR_USER(user) { _CUR_USER = user; }

    static _get(url, data, type)
    {
        return $.ajax(url,
            {
                type: "GET",
                data: data,
                statusCode:
                {
                    429: xhr => xhr.fail()
                }
            });
    }
    static _post(url, data)
    {
        let cType;
        if (typeof data == "string")
            cType = "application/x-www-form-urlencoded";
        else
        {
            cType = "application/json";
            data = JSON.stringify(data);
        }
        return $.ajax(url,
            {
                type: "POST",
                contentType: cType,
                //dataType: "json",
                data: data
            });
    }
    static _report(target, data)
    {
        if (!data || (data instanceof Array && data.length === 0))
            return;
        chrome.runtime.sendMessage({ action: "insert", target: target, data: data });
    }
    static _update(target, key, objs, updator)
    {
        if (!objs || (objs instanceof Array && objs.length === 0))
            return;
        chrome.runtime.sendMessage({ action: "update", target: target, data: { key: key, obj: objs, updator: updator } });
    }

    static keepOnlyDataDiv(rawhtml)
    {
        return rawhtml.substring(rawhtml.indexOf('<div id="data"'), rawhtml.lastIndexOf('</div><script'));
    }

    static parseEntities(data)
    {
        const acts = Object.values(data.activities);
        const users = [], zans = [], answers = [], quests = [];
        for (let i = 0; i < acts.length; ++i)
        {
            const act = acts[i];
            let user = User.fromRawJson(act.actor);
            if (user && act.verb === "ANSWER_VOTE_UP" && act.target.schema === "answer")
            {
                zans.push(new Zan(user, act.target.id));
            }
        }
        const anss = Object.values(data.answers);
        for (let i = 0; i < anss.length; ++i)
        {
            const ans = anss[i];
            const qst = ans.question;
            const ansUser = User.fromRawJson(ans.author);
            if (!_CUR_USER || ansUser.id != _CUR_USER.id)
                users.push(ansUser);
            if (qst.author)
                users.push(User.fromRawJson(qst.author));

            const quest = new Question(qst.id, qst.title, qst.boundTopicIds);
            quests.push(quest);
            const answer = new Answer();
            answer.id = "" + ans.id;
            answer.author = ansUser.id;
            answer.zancnt = ans.voteupCount;
            answer.question = quest.id;
            answers.push(answer);
        }
        return { "users": users, "zans": zans, "answers": answers, "questions": quests };
    }


    static async getAnsVoters(ansId, limit, config, onProgress)
    {
        const first = await _getAnsVoters(ansId, 0);
        let ret = first.users;
        const total = Math.min(first.total, limit);
        let left = total - first.users.length;
        if (left <= 0)
            return ret;
        let offset = 20;
        if (config === "old")
            offset = first.total - left;
        while (left > 0)
        {
            const part = await _getAnsVoters(ansId, offset);
            ret = ret.concat(part.users);
            const len = part.users.length;
            offset += len, left -= len;
            if (onProgress)
                onProgress(ret.length, total);
        }
        return ret;
    }
}