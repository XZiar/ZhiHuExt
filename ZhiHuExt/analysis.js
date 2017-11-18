"use strict"



/**
 * @template T
 * @template R
 * @param {{key: T, count: number}[]} bagArray
 * @param {{[x: T]: R}} detailMap
 * @param {string} newProp
 * @returns {{[newProp: string]:T|R, count: number}[]}
 */
function tryReplaceDetailed(bagArray, detailMap, newProp)
{
    const ret = [];
    for (let i = 0; i < bagArray.length; ++i)
    {
        const item = bagArray[i];
        const res = { "count": item.count };
        const key = item.key;
        /**@type {R}*/
        const detail = detailMap[key];
        res[newProp] = (detail === undefined ? key : detail);
        ret.push(res);
    }
    return ret;
}

class Analyse
{
    static generateBlob(obj)
    {
        const blob = new Blob([JSON.stringify(obj)], { type: "application/json" });
        return URL.createObjectURL(blob);
    }

    static get STR_AUTHOR()
    { return 'Analyse.findAuthorOfUserVote(BAN_UID).then(x=>console.log(x.map(y=>y.count+" --- "+(y.user instanceof Object?y.user.name+"  ===  "+y.user.id+"  ===  "+y.user.status:"    ===  "+y.user))))'; }
    static get STR_QUEST()
    { return 'Analyse.findQuestOfUserVote(BAN_UID).then(x=>console.log(x.map(y=>y.count+" --- "+(y.question instanceof Object?y.question.title+"  ===  "+y.question.id:"   ===  "+y.question))))'; }
    static get STR_TOPIC()
    { return 'Analyse.findTopicOfUserVote(BAN_UID).then(x=>console.log(x.map(y=>y.count+" --- "+(y.topic instanceof Object?y.topic.name+"  ===  "+y.topic.id:"   ===  "+y.topic))))'; }
    static get STR_QST_URL()
    { return 'Analyse.findQuestOfUserVote(BAN_UID).then(x=>hurls=x.map(y=>"https://www.zhihu.com/question/"+(y.question instanceof Object?y.question.id:y.question)))'; }
    static get STR_MISS_TOPIC()
    { return 'Analyse.findQuestOfUserVote(BAN_UID).then(x=>console.log(x.filter(y=>y.question instanceof Object?!(y.question.topics||y.question.topics.length>0):true).map(y=>y.count+" --- https://www.zhihu.com/question/"+(y.question instanceof Object?y.question.id:y.question))))'; }

    static async showPopAnswer(uid, limit)
    {
        let zanAnss = await db.getAnsIdByVoter(uid, "desc");
        if (limit)
            zanAnss = zanAnss.slice(0, limit);
        const blobstr = Analyse.generateBlob(zanAnss);
        chrome.tabs.create({ active: true, url: "AssocAns.html?ansblob=" + blobstr });
    }
    /**
     * @param {number | number[]} ansid
     * @param {number | number[]} artid
     * @param {number} mincount
     * @param {...Set<string>} filters
     */
    static async filterOutsideVotersById(ansid, artid, mincount, ...filters)
    {
        const ansv = await db.getVoters(ansid, "answer");
        const artv = await db.getVoters(artid, "article");
        const bag = new SimpleBag().union(ansv).union(artv);
        const ret = bag.above(mincount).filter(uid =>
        {
            for (const f of filters)
                if (f.has(uid))
                    return false;
            return true;
        }).elements();
        $("#copyData").val(JSON.stringify(ret));
        $("#copyBtn")[0].click();
        console.log("copied");
    }
    /**
     * @param {string | string[]} author
     * @param {number} mincount
     * @param {...Set<string>} filters
     */
    static async filterOutsideVotersByAuthor(author, mincount, ...filters)
    {
        const ansid = await db.getIdByAuthor(author, "answer");
        const artid = await db.getIdByAuthor(author, "article");
        Analyse.filterOutsideVotersById(ansid, artid, mincount, ...filters);
    }

    static async findQuestOfUserVote(uid)
    {
        const zanAnss = await db.getAnsIdByVoter(uid);
        const qsts = await db.getQuestIdByAnswer(zanAnss);
        const qstMap = await db.getDetailMapOfIds(db.questions, qsts, "id");
        console.log("get [" + Object.keys(qstMap).length + "] questions");
        return tryReplaceDetailed(qsts, qstMap, "question");
    }
    static async findAuthorOfUserVote(uid)
    {
        const zanAnss = await db.getAnsIdByVoter(uid);
        const ansMap = await db.getPropMapOfIds(db.answers, zanAnss, "author");
        console.log("get [" + Object.keys(ansMap).length + "] answers");
        const authorBag = new SimpleBag();
        zanAnss.forEach(zanans => authorBag.addMany(ansMap[zanans.key], zanans.count));
        const aths = authorBag.toArray("desc");
        console.log("reduce to [" + aths.length + "] authors");
        const athMap = await db.getDetailMapOfIds(db.users, aths, "id");
        console.log("get [" + Object.keys(athMap).length + "] authors");
        return tryReplaceDetailed(aths, athMap, "user");
    }
    static async findSimilarUserOfAnswerVote(ansid)
    {
        const zanUsers = await db.getVoters(ansid, "answer");
        const userMap = await db.getDetailMapOfIds(db.users, zanUsers, "id");
        console.log("get [" + Object.keys(userMap).length + "] users");
        return tryReplaceDetailed(zanUsers, userMap, "user");
    }
    static async findSimilarUserInAnsOfAnswerVote(objAns, refAns)
    {
        const zanUsers = await db.getVoters(refAns, "answer");
        const objUsers = new Set((await db.zans.where("to").equals(objAns).toArray()).mapToProp("from"));
        console.log("get [" + objUsers.size + "] obj voters");
        const resUsers = zanUsers.filter(usr => objUsers.has(usr.key));
        console.log("restrict to [" + resUsers.length + "] target voters");
        const userMap = await db.getDetailMapOfIds(db.users, resUsers, "id");
        console.log("get [" + Object.keys(userMap).length + "] users");
        return tryReplaceDetailed(resUsers, userMap, "user");
    }
    static async findTopicOfUserVote(uid)
    {
        const quests = await db.getAnsIdByVoter(uid);
        const topicBag = new SimpleBag();
        quests.forEach(quest =>
        {
            if (quest.question instanceof Object)
                quest.question.topics.forEach(tid => topicBag.addMany(tid, quest.count));
        });
        const tps = topicBag.toArray("desc");
        console.log("reduce to [" + tps.length + "] topics");
        const topicMap = await db.getDetailMapOfIds(db.topics, tps, "id");
        console.log("get [" + Object.keys(topicMap).length + "] topics");
        return tryReplaceDetailed(tps, topicMap, "topic");
    }
    static async findUserSimilarityInVote(uid)
    {
        const uid0 = await toPureArray(uid);
        const uid1 = new Set(uid0);
        uid1.delete("");//except anonymous user
        const uids = uid1.toArray();
        console.log("Analyse Similarity here [" + uids.length + "] uids");

        /**@type {[Promise<Zan[]>, Promise<Zan[]>]}*/
        const zanquerys = [db.zans.where("from").anyOf(uids).toArray(), db.zanarts.where("from").anyOf(uids).toArray()];
        const [anszan, artzan] = await Promise.all(zanquerys);
        console.log(`get [${anszan.length}] answer records`, `get [${artzan.length}] article records`);

        const zancounter = new SimpleBag(anszan.mapToProp("from"));
        zancounter.adds(artzan.mapToProp("from"));

        const zancounter2 = new SimpleBag();
        {
            /**@type {Set<string>}*/
            const banusers = zancounter.toSet().intersection(BAN_UID);
            const involvedAnss = new Set(anszan.filter(zan => banusers.has(zan.from)).mapToProp("to"));
            anszan.filter(zan => involvedAnss.has(zan.to)).forEach(zan => zancounter2.add(zan.from));
            const involvedArts = new Set(artzan.filter(zan => banusers.has(zan.from)).mapToProp("to"));
            artzan.filter(zan => involvedArts.has(zan.to)).forEach(zan => zancounter2.add(zan.from));
            console.log(`find [${banusers.size}] banned users`, `involve [${involvedAnss.size + involvedArts.size}] objects`);
        }

        const log3 = x => Math.log2(x) / Math.log2(3);
        /**@type {number} log3(1~(zan-50))-0.5 => [1,9]*/
        const minrepeat = Math.minmax(Math.floor(log3(Math.max(uids.length - 50, 1)) - 0.5), 1, 9);
        const ansset = new SimpleBag(anszan.mapToProp("to")).above(minrepeat).toSet();
        const artset = new SimpleBag(artzan.mapToProp("to")).above(minrepeat).toSet();
        console.log(`reduce to [${ansset.size}] answer records`, `reduce to [${artset.size}] article records`);

        const voterbag = new SimpleBag();
        for (let i = 0; i < anszan.length; ++i)
        {
            const zan = anszan[i];
            if (ansset.has(zan.to))
                voterbag.add(zan.from);
        }
        for (let i = 0; i < artzan.length; ++i)
        {
            const zan = artzan[i];
            if (artset.has(zan.to))
                voterbag.add(zan.from);
        }

        /**@type {[string, [number, number, number]][]}*/
        const result = voterbag.map((uid, count) => [uid, [count, zancounter2.count(uid), zancounter.count(uid)]]);
        console.log(`Analyse Similarity finished, threshold [${minrepeat}]`);
        return { data: result, limit: minrepeat };
    }
}