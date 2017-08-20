"use strict"

function tryReplaceDetailed(array, detailMap, newProp)
{
    const ret = [];
    for (let i = 0; i < array.length; ++i)
    {
        const item = array[i];
        const res = { "count": item.count };
        const key = item.key;
        const detail = detailMap[key];
        res[newProp] = (detail === undefined ? key : detail);
        ret.push(res);
    }
    return ret;
}

class Analyse
{
    static get STR_AUTHOR()
    { return 'Analyse.findAuthorOfUserVote(BAN_UID.toArray()).then(x=>console.log(x.map(y=>y.count+" --- "+(y.user instanceof String?"    ===  "+y.user : y.user.name+"  ===  "+y.user.id+"  ===  "+y.user.status))))'; }
    static get STR_QUEST()
    { return 'Analyse.findQuestOfUserVote(BAN_UID.toArray()).then(x=>console.log(x.map(y=>y.count+" --- "+(y.question instanceof String?"   ===  "+y.question : y.question.title+"  ===  "+y.question.id))))'; }


    static async findAnsIdOfUserVote(uids, order)
    {
        console.log("here [" + uids.length + "] uids");
        const zans = await db.zans.where("from").anyOf(uids).toArray();
        console.log("get [" + zans.length + "] zans");
        const zanAnss = new SimpleBag(zans.mapToProp("to")).toArray(order);
        console.log("reduce to [" + zanAnss.length + "] answers");
        return zanAnss;
    }
    static async findQuestOfUserVote(uids)
    {
        const zanAnss = await Analyse.findAnsIdOfUserVote(uids);
        const ansMap = await db.answers.where("id").anyOf(zanAnss.mapToProp("key")).toPropMap("id", "question");
        console.log("get [" + Object.keys(ansMap).length + "] answers");
        const questBag = new SimpleBag();
        zanAnss.forEach(zanans => questBag.addMany(ansMap[zanans.key], zanans.count));
        const qsts = questBag.toArray("desc");
        console.log("reduce to [" + qsts.length + "] questions");
        const qstMap = await db.questions.where("id").anyOf(qsts.mapToProp("key")).toNameMap("id");
        console.log("get [" + Object.keys(qstMap).length + "] questions");
        return tryReplaceDetailed(qsts, qstMap, "question");
    }
    static async findAuthorOfUserVote(uids)
    {
        const zanAnss = await Analyse.findAnsIdOfUserVote(uids);
        const ansMap = await db.answers.where("id").anyOf(zanAnss.mapToProp("key")).toPropMap("id", "author");
        console.log("get [" + Object.keys(ansMap).length + "] answers");
        const authorBag = new SimpleBag();
        zanAnss.forEach(zanans => authorBag.addMany(ansMap[zanans.key], zanans.count));
        const aths = authorBag.toArray("desc");
        console.log("reduce to [" + aths.length + "] authors");
        const athMap = await db.users.where("id").anyOf(aths.mapToProp("key")).toNameMap("id");
        console.log("get [" + Object.keys(athMap).length + "] authors");
        return tryReplaceDetailed(aths, athMap, "user");
    }
    static async findSimilarOfAnswerVote(ansids)
    {
        console.log("here [" + ansids.length + "] ansids");
        const zans = await db.zans.where("to").anyOf(ansids).toArray();
        console.log("get [" + zans.length + "] zans");
        const zanUsers = new SimpleBag(zans.mapToProp("from")).toArray("desc");
        console.log("reduce to [" + zanUsers.length + "] voters");
        const userMap = await db.users.where("id").anyOf(zanUsers.mapToProp("key")).toNameMap("id");
        console.log("get [" + Object.keys(userMap).length + "] users");
        return tryReplaceDetailed(zanUsers, userMap, "user");
    }
}