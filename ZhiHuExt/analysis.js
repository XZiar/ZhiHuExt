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
    { return 'Analyse.findAuthorOfUserVote(BAN_UID.toArray()).then(x=>console.log(x.map(y=>y.count+" --- "+(y.user instanceof Object?y.user.name+"  ===  "+y.user.id+"  ===  "+y.user.status:"    ===  "+y.user))))'; }
    static get STR_QUEST()
    { return 'Analyse.findQuestOfUserVote(BAN_UID.toArray()).then(x=>console.log(x.map(y=>y.count+" --- "+(y.question instanceof Object?y.question.title+"  ===  "+y.question.id:"   ===  "+y.question))))'; }
    static get STR_TOPIC()
    { return 'Analyse.findTopicOfUserVote(BAN_UID.toArray()).then(x=>console.log(x.map(y=>y.count+" --- "+(y.topic instanceof Object?y.topic.name+"  ===  "+y.topic.id:"   ===  "+y.topic))))'; }
    static get STR_QST_URL()
    { return 'Analyse.findQuestOfUserVote(BAN_UID.toArray()).then(x=>hurls=x.map(y=>"https://www.zhihu.com/question/"+(y.question instanceof Object?y.question.id:y.question)))'; }
    static get STR_MISS_TOPIC()
    { return 'Analyse.findQuestOfUserVote(BAN_UID.toArray()).then(x=>console.log(x.filter(y=>y.question instanceof Object?!(y.question.topics||y.question.topics.length>0):true).map(y=>y.count+" --- https://www.zhihu.com/question/"+(y.question instanceof Object?y.question.id:y.question))))'; }

    //
    static async getSpamBan(uidset)
    {
        const spams = await db.spams.where("type").equals("member").toArray();
        return (new Set([...(spams.mapToProp("id")), ...uidset])).toArray();
    }
    static async getUserMap(uids)
    {
        return await db.users.where("id").anyOf(uids).toNameMap("id");
    }
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
        const athMap = await Analyse.getUserMap(aths.mapToProp("key"));
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
        const userMap = await Analyse.getUserMap(zanUsers.mapToProp("key"));
        console.log("get [" + Object.keys(userMap).length + "] users");
        return tryReplaceDetailed(zanUsers, userMap, "user");
    }
    static async fintSimilarInAnsOfAnswerVote(objAns, refAnss)
    {
        console.log("here [" + refAnss.length + "] ref answers");
        const zans = await db.zans.where("to").anyOf(refAnss).toArray();
        console.log("get [" + zans.length + "] zans");
        const zanUsers = new SimpleBag(zans.mapToProp("from")).toArray("desc");
        console.log("reduce to [" + zanUsers.length + "] voters");
        const objUsers = new Set((await db.zans.where("to").equals(objAns).toArray()).mapToProp("from"));
        console.log("get [" + objUsers.size + "] obj voters");
        const resUsers = zanUsers.filter(usr => objUsers.has(usr.key));
        console.log("restrict to [" + resUsers.length + "] target voters");
        const userMap = await Analyse.getUserMap(resUsers.mapToProp("key"));
        console.log("get [" + Object.keys(userMap).length + "] users");
        return tryReplaceDetailed(resUsers, userMap, "user");
    }
    static async findTopicOfUserVote(uids)
    {
        const quests = await Analyse.findQuestOfUserVote(uids);
        const topicBag = new SimpleBag();
        quests.forEach(quest =>
        {
            if (quest.question instanceof Object)
                quest.question.topics.forEach(tid => topicBag.addMany(tid, quest.count));
        });
        const tps = topicBag.toArray("desc");
        console.log("reduce to [" + tps.length + "] topics");
        const topicMap = await db.topics.where("id").anyOf(tps.mapToProp("key")).toNameMap("id");
        console.log("get [" + Object.keys(topicMap).length + "] topics");
        return tryReplaceDetailed(tps, topicMap, "topic");
    }
}