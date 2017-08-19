"use strict"



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
}