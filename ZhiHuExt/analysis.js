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

    static async showPopAnswer(uid, limit)
    {
        let zanAnss = await db.getIdByVoter(uid, "answer", "desc");
        if (limit)
            zanAnss = zanAnss.slice(0, limit);
        const blobstr = Analyse.generateBlob(zanAnss);
        chrome.tabs.create({ active: true, url: "AssocAns.html?ansblob=" + blobstr });
    }
    static async showPopAuthor(uid, limit)
    {
        const [zanAnss, zanArts] = await Promise.all([db.getIdByVoter(uid, "answer"), db.getIdByVoter(uid, "article")]);
        const ansid = zanAnss.mapToProp("key"), artid = zanArts.mapToProp("key");
        const [ansmap, artmap] = await Promise.all([db.getPropMapOfIds("answers", ansid, "author"), db.getPropMapOfIds("articles", artid, "author")]);
        const athBag = new SimpleBag();
        zanAnss.forEach(zan => athBag.addMany(_any(ansmap[zan.key], "**"), zan.count));
        zanArts.forEach(zan => athBag.addMany(_any(artmap[zan.key], "**"), zan.count));
        let authors = athBag.removeAll("**").toArray("desc");//remove unknown author
        if (limit)
            authors = authors.slice(0, limit);
        const blobstr = Analyse.generateBlob(authors);
        chrome.tabs.create({ active: true, url: "StatVoter.html?votblob=" + blobstr });
    }
    /**
     * @param {any} uid
     * @param {number} limit
     * @param {number} limitVoter
     * @param {...Set<string>} filters
     */
    static async findSimilarVoter(uid, limit, limitVoter, ...filters)
    {
        const uids = await toPureArray(uid);
        const [zanAnss, zanArts] = await Promise.all([db.getIdByVoter(uid, "answer"), db.getIdByVoter(uid, "article")]);
        const ansid = zanAnss.filter(x => x.count > limit).mapToProp("key"), artid = zanArts.filter(x => x.count > limit).mapToProp("key");
        const pmss = [db.getVoters(ansid, "answer"), db.getVoters(artid, "article")];
        const filset = new Set(uids);
        for (const f of filters)
            for (const ele of f)
                filset.add(ele);
        let [ansVoter, artVoter] = await Promise.all(pmss);
        const voterBag = new SimpleBag().union(ansVoter.filter(x => !filset.has(x.key))).union(artVoter.filter(x => !filset.has(x.key)));
        const voters = voterBag.above(limitVoter).toArray("desc");
        const blobstr = Analyse.generateBlob(voters);
        chrome.tabs.create({ active: true, url: "StatVoter.html?votblob=" + blobstr });
    }
    /**
     * @param {any} uid
     * @param {number} limit
     */
    static async findRelatedAnswers(uid, limit)
    {
        let zanAnss = await db.getIdByVoter(uid, "answer", "desc");
        if (limit)
            zanAnss = zanAnss.slice(0, limit);
        const zanBag = new SimpleBag(await db.zans.where("to").anyOf(zanAnss.mapToProp("key")).keys());
        const blobstr = Analyse.generateBlob(zanBag.toArray());
        chrome.tabs.create({ active: true, url: "AssocAns.html?ansblob=" + blobstr });
    }
    /**
     * @param {any} uid
     * @param {number} days
     * @param {...Set<string>} filters
     */
    static async findRecentAnswers(uid, days, ...filters)
    {
        const uids = await toPureArray(uid);
        const limtime = new Date().toUTCSeconds() - days * 24 * 3600;
        const zans = await db.zans.where("from").anyOf(uids).toArray();
        const zanBag = new SimpleBag(zans.filter(zan => zan.time < 0 || zan.time > limtime).mapToProp("to"))
        const blobstr = Analyse.generateBlob(zanBag.toArray());
        chrome.tabs.create({ active: true, url: "AssocAns.html?ansblob=" + blobstr });
    }

    /**
     * @param {Zan[]} zans
     * @return {[string, number, number, string, number, number][]}
     */
    static _zanToCSV(zans)
    {
        return zans.sort((a, b) => a.time - b.time).map(zan =>
        {
            const [, mon, day, hour, minu, sec,] = Date.getDetailCHN(zan.time);
            return [zan.from, zan.to, zan.time, `${mon}/${day}`, sec + minu * 60 + hour * 3600, minu + hour * 60];
        });
    }
    static async outputUserActs(uid, returnit)
    {
        const uids = await toPureArray(uid);
        /**@type {[Zan[],Zan[]]}*/
        const [zananss, zanarts] = await Promise.all([db.zans.where("from").anyOf(uids).toArray(), db.zanarts.where("from").anyOf(uids).toArray()]);
        if (returnit)
        {
            /**@type {{[x:string]:User}}*/
            const users = await db.getDetailMapOfIds("users", uids, "id");
            return { zananss: zananss, zanarts: zanarts, users: users };
        }
        const zans = zananss.concat(zanarts);
        const head = "\uFEFF" + "点赞人,点赞目标,点赞时间,点赞日期,当日计秒,当日分钟\n";
        const zandata = Analyse._zanToCSV(zans);
        const csvstr = zandata.map(dat => dat.join(',')).join('\n');
        DownloadMan.exportDownload(head + csvstr, "txt", `acts#${uids}#${new Date().Format("yyMMdd-hhmm")}.csv`);
    }
    static async outputAActs(aid, type, returnit)
    {
        const aids = await toPureArray(aid);
        let pmss;
        if (type === "article")
            pmss = [db.zanarts.where("to").anyOf(aids).toArray(), db.getDetailMapOfIds("articles", aids, "id")];
        else
            pmss = [db.zans.where("to").anyOf(aids).toArray(), db.getDetailMapOfIds("answers", aids, "id")];
        /**@type {[Zan[], {[x:number]:Answer|Article}]}*/
        const [zans, objs] = await Promise.all(pmss);
        if (returnit)
            return { zans: zans, objs: objs };
        const head = "\uFEFF" + "点赞人,点赞目标,点赞时间,点赞日期,当日计秒,当日分钟\n";
        const selfdata = Object.values(objs).sort((a, b) => a.timeC - b.timeC).map(ans =>
        {
            const [, mon, day, hour, minu, sec,] = new Date(ans.timeC * 1000).getDetailCHN();
            return [ans.author, ans.id, ans.timeC, `${mon}/${day}`, sec + minu * 60 + hour * 3600, minu + hour * 60];
        });
        const zandata = Analyse._zanToCSV(zans);
        const csvdata = zandata.concat(selfdata);
        const csvstr = csvdata.map(dat => dat.join(',')).join('\n');
        DownloadMan.exportDownload(head + csvstr, "txt", `acts#${aids}#${new Date().Format("yyMMdd-hhmm")}.csv`);
    }
    static async outputQuestActs(qid, returnit)
    {
        const qids = await toPureArray(qid);
        const retpms = Analyse.outputAActs(await db.getAnsIdByQuestion(qids), "answer", returnit);
        if (returnit)
        {
            /**@type {{[x:number]:Question[]}}*/
            const qsts = await db.getDetailMapOfIds("questions", qids, "id");
            const ret = await retpms;
            return { zans: ret.zans, anss: ret.objs, qsts: qsts };
        }
    }
    static async outputAuthorActs(uid, returnit)
    {
        const uids = await toPureArray(uid);
        const [ansids, artids] = await Promise.all([db.getIdByAuthor(uids, "answer"), db.getIdByAuthor(uids, "article")]);

        const pmss = [db.zans.where("to").anyOf(ansids).toArray(), db.getDetailMapOfIds("answers", ansids, "id"), db.zanarts.where("to").anyOf(artids).toArray(), db.getDetailMapOfIds("articles", artids, "id")];
        /**@type {[Zan[], {[x:number]:Answer}, Zan[], {[x:number]:Article}]}*/
        const [zananss, anss, zanarts, arts] = await Promise.all(pmss);
        if (returnit)
        {
            /**@type {{[x:string]:User}}*/
            const users = await db.getDetailMapOfIds("users", uids, "id");
            return { zananss: zananss, zanarts: zanarts, anss: anss, arts: arts, users: users };
        }
        const head = "\uFEFF" + "点赞人,点赞目标,点赞时间,点赞日期,当日计秒,当日分钟\n";
        const selfdata = Object.values(anss).concat(Object.values(arts))
            .sort((a, b) => a.timeC - b.timeC).map(obj =>
            {
                    const [, mon, day, hour, minu, sec,] = new Date(obj.timeC * 1000).getDetailCHN();
                    return [obj.author, obj.id, obj.timeC, `${mon}/${day}`, sec + minu * 60 + hour * 3600, minu + hour * 60];
            });
        const zans = zananss.concat(zanarts);
        const zandata = Analyse._zanToCSV(zans);
        const csvdata = zandata.concat(selfdata);
        const csvstr = csvdata.map(dat => dat.join(',')).join('\n');
        DownloadMan.exportDownload(head + csvstr, "txt", `acts#author#${uids}#${new Date().Format("yyMMdd-hhmm")}.csv`);

        if (returnit)
        {
            /**@type {{[x:number]:Question[]}}*/
            const qsts = await db.getDetailMapOfIds("questions", qids, "id");
            const ret = await retpms;
            return { zans: ret.zans, anss: ret.objs, qsts: qsts };
        }
    }
    /**
     * @param {[string, number, number, string, number, number][]} zandata
     * @param {{[x:number]:number}} objmap
     * @return {[string, number, number, string, number, number, number, number, number][]}
     */
    static _ZanAndObj(zandata, objmap)
    {
        return zandata.map(x =>
        {
            const timec = objmap[x[1]] || -1;
            const diffC = x[2] - timeC;
            const fixtime = diffC < 0 ? -1 : Math.max(Math.round(diffC / 60), 60 * 24);
            return x.concat([timeC, diffC, fixtime]);
        });
    }
    static async outputReactSpeed(uid, returnit)
    {
        const uids = await toPureArray(uid);
        /**@type {[Zan[],Zan[]]}*/
        const [zans, zanarts] = await Promise.all([db.zans.where("from").anyOf(uids).toArray(), db.zanarts.where("from").anyOf(uids).toArray()]);
        const pmss = Promise.all([db.getPropMapOfIds("answers", zans.mapToProp("to"), "timeC"), db.getPropMapOfIds("articles", zanarts.mapToProp("to"), "timeC")]);
        const head = "\uFEFF" + "点赞人,点赞目标,点赞时间,点赞日期,当日计秒,当日分钟,目标时间,间隔秒,间隔分钟\n";
        const ansdata = Analyse._zanToCSV(zans);
        const artdata = Analyse._zanToCSV(zanarts);
        /**@type {{[x:number]:number}[]}*/
        const [anstime, arttime] = await pmss;
        const retdata = Analyse._ZanAndObj(ansdata, anstime).concat(Analyse._ZanAndObj(artdata, arttime)).sort((a, b) => a[2] - b[2]);
        if (returnit)
            return retdata;
        const csvstr = retdata.map(dat => dat.join(',')).join('\n');
        DownloadMan.exportDownload(head + csvstr, "txt", `racspd#${uids}#${new Date().Format("yyMMdd-hhmm")}.csv`);
    }

    /**
     * @param {number | number[]} ansid
     * @param {number | number[]} artid
     * @param {number} mincount
     * @param {...Set<string>} filters
     */
    static async filterOutsideVotersById(ansid, artid, mincount, ...filters)
    {
        const pmss = [db.getVoters(ansid, "answer"), db.getVoters(artid, "article")];
        const filset = new Set();
        for (const f of filters)
            for (const ele of f)
                filset.add(ele);
        const [ansv, artv] = await Promise.all(pmss);
        const bag = new SimpleBag().union(ansv).union(artv);
        const ret = bag.above(mincount).filter(uid => !filset.has(uid)).elements();
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
        const voterPms = db.getVotersByAuthor(author, "desc", mincount);
        const filset = new Set();
        for (const f of filters)
            for (const ele of f)
                filset.add(ele);
        const ret = (await voterPms).mapToProp("key").filter(x => !filset.has(x));
        $("#copyData").val(JSON.stringify(ret));
        $("#copyBtn")[0].click();
        console.log("copied");
    }

    static async findQuestOfUserVote(uid)
    {
        const zanAnss = await db.getIdByVoter(uid, "answer");
        const qsts = await db.getQuestIdByAnswer(zanAnss);
        const qstMap = await db.getDetailMapOfIds(db.questions, qsts, "id");
        console.log("get [" + Object.keys(qstMap).length + "] questions");
        return tryReplaceDetailed(qsts, qstMap, "question");
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
        const answers = await db.getIdByVoter(uid, "answer");
        const topicBag = new SimpleBag();
        answers.forEach(ans =>
        {
            if (ans.question instanceof Object)
                ans.question.topics.forEach(tid => topicBag.addMany(tid, ans.count));
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