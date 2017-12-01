"use strict"
//import { Dexie } from "./dexie.min.js"


let TIMER_CLEAR_BADGE = setTimeout(clearBadge, 0);
/**@param {number} num */
function putBadge(num)
{
    clearTimeout(TIMER_CLEAR_BADGE);
    chrome.browserAction.setBadgeText({ text: "" + num });
    TIMER_CLEAR_BADGE = setTimeout(clearBadge, 500);
}
function clearBadge()
{
    chrome.browserAction.setBadgeText({ text: "" });
}


const db = new ZhiHuDB("ZhihuDB", [
    {
        spams: "id,type",
        users: "id,status,anscnt,follower",
        follows: "[from+to],from,to",
        zans: "[from+to],from,to,time",
        zanarts: "[from+to],from,to,time",
        answers: "id,author,question,timeC",
        questions: "id,timeC",
        articles: "id,author,timeC",
        topics: "id"
    },
    {
        spams: "id,type",
        users: "id,status,anscnt,follower,zancnt",
        follows: "[from+to],from,to",
        zans: "[from+to],from,to,time",
        zanarts: "[from+to],from,to,time",
        answers: "id,author,question,timeC",
        questions: "id,timeC",
        articles: "id,author,timeC",
        topics: "id"
    },
    {
        spams: "id,type",
        users: "id,status,anscnt,follower,zancnt",
        follows: "[from+to],from,to",
        zans: "[from+to],from,to,time",
        zanarts: "[from+to],from,to,time",
        answers: "id,author,question,timeC",
        questions: "id,timeC",
        articles: "id,author,timeC",
        topics: "id",
        rectime: "id,new,old"
    }], [
        null,
        trans => trans.users.toCollection().modify(u => u.zancnt = -1),
        async trans =>
        {
            /**@type {Map<string,number[]>} */
            const zantime = new Map();
            const curtime = new Date().toUTCSeconds();
            const jober = zan =>
            {
                const oldtime = zantime.get(zan.from);
                if (!oldtime)
                    zantime.set(zan.from, [zan.time, zan.time]);
                else if (zan.time > oldtime[0])
                    zantime.set(zan.from, [zan.time, oldtime[1]]);
                else if (zan.time < oldtime[1])
                    zantime.set(zan.from, [oldtime[0], zan.time]);
            };
            await trans.zanarts.where("time").above(0).each(jober);
            console.log("[zanarts] iterated");
            await trans.zans.where("time").above(0).each(jober);
            console.log("[zans] iterated");
            const recs = Array.from(zantime.entries()).map(x => ({ id: x[0], new: x[1][0], old: x[1][1] }));
            console.log("[rectime] mapped");
            await trans.rectime.bulkAdd(recs);
        }],
    async () =>
    {
        console.log("initializing reading");
        const loader = [db.users.where("status").anyOf(["ban", "sban"]).primaryKeys(), db.spams.where("type").equals("member").primaryKeys()];
        const [ban, spam] = await Promise.all(loader);
        BAN_UID = new Set(ban);
        SPAM_UID = new Set(spam);
        console.log("readed", "BAN_UID:" + BAN_UID.size, "SPAM_UID:" + SPAM_UID.size);
    });




/**@param {number | string} tid */
function fetchTopic(tid)
{
    $.ajax("https://www.zhihu.com/api/v4/topics/" + tid, { type: "GET" })
        .done(data =>
        {
            const topic = new Topic(data.id, data.name);
            db.insert("topics", topic);
        });
}


/**
 * @param {string[]} waitUsers
 * @param {boolean} [keepNormal]
 */
function checkSpamUser(waitUsers, keepNormal)
{
    const ret = { banned: [], spamed: [], normal: [] };
    const [bannedPart, unbannedPart] = splitInOutSide(waitUsers, BAN_UID);
    ret.banned = bannedPart;

    const [spamedIds, normalPart] = splitInOutSide(unbannedPart, SPAM_UID);
    ret.spamed = spamedIds;
    if (keepNormal)
        ret.normal = normalPart;
    return ret;
}

/**
 * @param {"answer" | "article"} target
 * @param {number | string} id
 */
async function checkUserSimilarity(target, id)
{
    const theid = Number(id);
    const voters = db.getVoters(theid, target);
    const result = await Analyse.findUserSimilarityInVote(voters);
    return result;
}

/**
 * @param {string} api
 * @param {number} id
 */
async function blocking(api, id)
{
    /**@type {Zan[]}*/
    const zans = await (api === "answer" ? db.zans : db.zanarts).where("to").equals(id).toArray();
    /**@type {{[x:string]: User}}*/
    const voters = await db.getDetailMapOfIds("users", zans.mapToProp("from"), "id");
    const retdata = zans.sort((x, y) => y.time - x.time)
        .filter(zan => voters[zan.from] != null)
        .map(zan =>
        {
            const usr = voters[zan.from];
            const ret =
            {
                answer_count: usr.anscnt,
                articles_count: usr.artcnt,
                avatar_url: "",
                avatar_url_template: "",
                badge: [],
                follower_count: usr.follower,
                gender: 0,
                headline: "已被知乎疯牛病接管",
                id: "#" + zan.time,
                is_advertiser: false,
                is_followed: false,
                is_org: false,
                name: usr.name,
                type: "people",
                url: `http://www.zhihu.com/api/v4/people/${usr.id}`,
                url_token: usr.id,
                user_type: "people"
                };
            return ret;
        });

    const ret =
        {
            data: retdata,
            paging:
            {
                is_end: true,
                is_start: true,
                next: "",
                previous: "",
                totals: voters.length
            }
        };
    return ret;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) =>
{
    switch (request.action)
    {
        case "copy":
            $("#copyData").val(request.data);
            $("#copyBtn")[0].click();
            break;
        case "stat":
            db.count().then(result =>
            {
                console.log("statics result:", result);
                sendResponse(result);
            });
            return true;
        case "chkspam":
            {
                if (request.target === "users")
                    sendResponse(checkSpamUser(request.data));
                else
                {
                    db.getVoters(request.data, request.target).then(voters =>
                    {
                        const result = checkSpamUser(voters.mapToProp("key"), true);
                        result.total = voters.length;
                        sendResponse(result);
                    });
                    return true;
                }
            } break;
        case "chksim":
            {
                checkUserSimilarity(request.target, request.data)
                    .then(res => sendResponse(res), err => console.warn(err));
            } return true;
        case "export":
            db.export().then(dbjson =>
            {
                const time = new Date().Format("yyyyMMdd-hhmm");
                const fname = "ZhiHuExtDB-" + time + ".json";
                DownloadMan.exportDownload(dbjson, "json", fname);
            }, error => console.warn("exportDB fail", error));
            break;
        case "partdb":
            db.part(request.target, request.from, request.count)
                .then(part =>
                {
                    if (part instanceof Array)
                    {
                        sendResponse(part); return;
                    }
                    const blob = new Blob([part], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    sendResponse(url);
                },
                err => console.warn(err));
            return true;
        case "insert":
            db.insert(request.target, request.data, putBadge);
            break;
        case "update":
            if (!db.update(request.target, request.data))
                console.warn("update wrong", request);
            break;
        case "openpage":
            chrome.tabs.create({ active: !request.isBackground, url: request.target });
            break;
        case "download":
            DownloadMan.exportDownload(request.data, request.type, request.fname);
            break;
        case "analyse":
            {
                /**@type {function}*/
                const fn = Analyse[request.method];
                if (fn)
                {
                    fn(request.argument).then(
                        ret => sendResponse(ret),
                        error => console.warn("calling analyse fail", error));
                }
                else
                    break;
            } return true;
        case "dbop":
            {
                /**@type {function}*/
                const fn = db[request.method];
                if (fn)
                {
                    fn.apply(db, request.argument).then(
                        ret => sendResponse(ret),
                        error => console.warn("calling database fail", error));
                }
                else
                    break;
            } return true;
        default:
            console.log("unknown action:" + request.action, request);
            break;
    }
});
chrome.runtime.onMessageExternal.addListener(
    /**@param {{ url: string, api: string, target: string, data: string, extra: {} }} request*/
    (request, sender, sendResponse) =>
    {
        const data = JSON.parse(request.data);
        switch (request.target)
        {
            case "activities":
                {
                    const res = APIParser.parsePureActivities(data.data);
                    db.insert("batch", res, putBadge);
                    console.log(request.target, res);
                } break;
            case "answers":
            case "articles":
            case "questions":
                {
                    const res = new StandardDB();
                    data.data.forEach(act => APIParser.parseByType(res, act));
                    db.insert("batch", res, putBadge);
                    if (request.api === "questions")
                        res.questions = [res.questions[0]];//reduce duplicated qsts
                    console.log(request.target, res);
                } break;
            case "relations":
                {
                    const users = data.data.map(User.fromRawJson);
                    db.insert("users", users, putBadge);
                    //console.log(request.target, users);
                } break;
            case "voters":
                {
                    const res = { users: data.data.map(User.fromRawJson) };
                    if (request.api === "answers")
                        res.zans = res.users.map(u => new Zan(u, request.extra.id));
                    else if (request.api === "articles")
                        res.zanarts = res.users.map(u => new Zan(u, request.extra.id));
                    db.insert("batch", res, putBadge);
                    //console.log("voters", res);
                } break;
            case "empty":
                {
                    const user = User.fromRawJson(data);
                    db.insert("users", user, putBadge);
                    console.log("user", user);
                } break;
            case "recommendations":
                {
                    const res = new StandardDB();
                    Object.values(data.data).forEach(act => APIParser.parseByType(res, act));
                    db.insert("batch", res, putBadge);
                    console.log("recommends", res);
                } break;
            case "publications":
                break;
            case "BLOCKING":
                {
                    blocking(request.api, request.id).then(x => sendResponse(JSON.stringify(x)));
                } return true;
            default:
                console.log("unknown-extern", request.target, request.url, data);
        }
    });

$(document).ready(function ()
{
    new Clipboard('#copyBtn');
});


