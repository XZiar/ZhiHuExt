
var db = new Dexie("ZhihuDB");
db.version(4).stores(
    {
        spams: "id,type",
        users: "id,anscnt,followcnt",
        follows: "[from+to],from,to",
        zans: "[from+to],from,to",
        answers: "id,author,question",
        questions: "id",
        topics: "id"
    })
    .upgrade(() =>
    {
    });
db.open().catch(e => console.error("cannot open db", e));



function insertDB(target, data)
{
    var table;
    switch (target)
    {
        case "spam":
            table = db.spams;
            break;
        case "users":
            table = db.users;
            break;
        case "follows":
            table = db.follows;
            break;
        case "zans":
            table = db.zans;
            break;
        case "answers":
            table = db.answers;
            break;
        case "questions":
            table = db.questions;
            break;
        case "topics":
            table = db.topics;
            break;
        default:
            console.warn("unknown target:" + target);
            return false;
    }
    console.log(target, data);
    var pms;
    if (!(data instanceof Array))
        pms = table.put(data);
    else if (data.length > 0)
        pms = table.bulkPut(data);
    else
        return false;
    pms.catch(error => console.warn("failed!", error, target, data));
    return true;
}
function countDB(idx, pms)
{
    if (idx == null)
    {
        pms = $.Deferred();
        pms.extraData = db.tables;
        pms.tmpResult = {};
        countDB(0, pms);
        return pms;
    }
    else
    {
        var tables = pms.extraData;
        if (idx < tables.length)
        {
            var table = tables[idx];
            table.count()
                .then(cnt => pms.tmpResult[table.name] = cnt)
                .catch(error => console.warn("counting error", error))
                .finally(() => countDB(idx + 1, pms));
        }
        else//finish
            pms.resolve(pms.tmpResult);
    }
}
function checkSpamUser(users)
{
    var ids = users.map(user => user.id);
    var spamsPms = db.spams.where("id").anyOf(ids)
        .filter(spam => spam.type == "member").primaryKeys();
    var pms = $.Deferred();
    spamsPms.then(uids =>
    {
        if (uids.length === 0)
        {
            pms.resolve([]);
            return;
        }
        db.users.where("id").anyOf(uids)
            .toArray(uss => pms.resolve(uss));
    })
    return pms;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) =>
{
    switch (request.action)
    {
        case "stat":
            countDB().then(result =>
            {
                console.log("statics result:", result);
                sendResponse(result);
            });
            return true;
        case "chkspam":
            checkSpamUser(request.data instanceof Array ? request.data : [request.data])
                .then(result =>
                {
                    console.log("check-spam result:", result);
                    sendResponse(result);
                });
            return true;
        case "insert":
            if (!insertDB(request.target, request.data))
                console.log("insert wrong", request);
            break;
        default:
            console.log("unknown action:" + request.action, request);
    }
});

$(document).ready(function ()
{
    new Clipboard('#copyBtn');
});

//import Dexie from "./Dependency/dexie.js"
