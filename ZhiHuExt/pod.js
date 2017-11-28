"use strict"

class UserToken
{
    /**
     * @param {{carCompose:string, xUDID:string, xsrf:string}} token
     */
    constructor(token)
    {
        this.authorization = token.carCompose ? token.carCompose.split("|") : null;
        this.xUDID = token.xUDID;
        this.xsrf = token.xsrf;
    }
    toHeader()
    {
        const auth = this.authorization ? "Bearer " + this.authorization.map(x => x.startsWith("4:") ? "4:z_c0" : x).join("|")
            : "oauth c3cef7c66a1843f8b3a9e6a1e3160e20";
        return { authorization: auth, "X-UDID": this.xUDID, "X-API-VERSION": "3.0.40" }
    }
}

class User
{
    constructor()
    {
        this.id = "";
        this.name = "";
        this.head = "";
        this.status = null;
        this.anscnt = -1;
        this.artcnt = -1;
        this.follower = -1;
        this.zancnt = -1;
    }

    /**@param {UserType} theuser*/
    static fromRawJson(theuser)
    {
        const user = new User();
        user.id = _any(theuser.urlToken, theuser.url_token, theuser.slug, "");//empty=>anomonyous
        user.name = theuser.name;
        if (theuser.avatar)
            user.head = theuser.avatar.id;
        else
            user.head = _any(theuser.avatarUrl, theuser.avatar_url).split("/").pop().replace(/_[\w]*.[\w]*$/, "");
        user.anscnt = _any(theuser.answerCount, theuser.answer_count, -1);
        user.follower = _any(theuser.followerCount, theuser.follower_count, -1);
        user.artcnt = _any(theuser.articlesCount, theuser.articles_count, -1);
        user.zancnt = _any(theuser.voteupCount, theuser.voteup_count, -1);
        const statuss = theuser.accountStatus;
        if (statuss)
        {
            if (statuss.find(x => x.name === "hang" || x.name === "lock"))
                user.status = "ban";
            else if (statuss.find(x => x.name === "ban" && x.expiredAt === 864000000))
                user.status = "sban";//shutup-ban
            else
                user.status = "";
        }
        //else if (theuser.isBanned)
        //    user.status = "sban";
        return user;
    }
}

class Question
{
    /**
     * @param {number | string} id
     * @param {string} title
     * @param {number | number[]} [topic]
     * @param {number} [timeCreated]
     */
    constructor(id, title, topic, timeCreated)
    {
        this.id = Number(id);
        this.title = title;
        if (topic)
            this.topics = topic instanceof Array ? topic : [topic];
        else
            this.topics = null;
        this.timeC = timeCreated == null ? -1 : timeCreated;
    }
}

class Article
{
    /**
     * @param {number | string} id
     * @param {string} title
     * @param {string} author
     * @param {number} [zancnt]
     * @param {string} [excerpt]
     * @param {number} [timeCreated]
     * @param {number} [timeUpdated]
     */
    constructor(id, title, author, zancnt, excerpt, timeCreated, timeUpdated)
    {
        this.id = Number(id);
        this.title = title;
        this.author = author;
        this.excerpt = excerpt == null ? null : excerpt;
        this.zancnt = zancnt == null ? -1 : zancnt;
        this.timeC = timeCreated == null ? -1 : timeCreated;
        this.timeU = timeUpdated == null ? -1 : timeUpdated;
    }
}

class Topic
{
    /**
     * @param {number | string} id
     * @param {string} name
     */
    constructor(id, name)
    {
        this.id = Number(id);
        this.name = name;
    }
}

class Answer
{
    /**
     * @param {number | string} id
     * @param {number | string} quest
     * @param {string} author
     * @param {number} [zancnt]
     * @param {string} [excerpt]
     * @param {number} [timeCreated]
     * @param {number} [timeUpdated]
     */
    constructor(id, quest, author, zancnt, excerpt, timeCreated, timeUpdated)
    {
        this.id = Number(id);
        this.question = Number(quest);
        this.author = author;//should not be null
        this.excerpt = excerpt == null ? null : excerpt;
        this.zancnt = zancnt == null ? -1 : zancnt;
        this.timeC = timeCreated == null ? -1 : timeCreated;
        this.timeU = timeUpdated == null ? -1 : timeUpdated;
    }
}

class Zan
{
    /**
     * @param {User | string} user
     * @param {string | number | Answer | Article} target
     * @param {number} [time]
     */
    constructor(user, target, time)
    {
        this.from = typeof(user) === "string" ? user : user.id;
        if (target instanceof Answer)
            this.to = target.id;
        else if (target instanceof Article)
            this.to = target.id;
        else
            this.to = Number(target);
        this.time = time == null ? -1 : time;
    }
}

class StandardDB
{
    constructor()
    {
        /**@type {User[]} users*/
        this.users = [];
        /**@type {Zan[]} zans*/
        this.zans = [];
        /**@type {Zan[]} zanarts*/
        this.zanarts = [];
        /**@type {Topic[]} topics*/
        this.topics = [];
        /**@type {Answer[]} answers*/
        this.answers = [];
        /**@type {Question[]} questions*/
        this.questions = [];
        /**@type {Article[]} articles*/
        this.articles = [];
    }
    /**
     * @template T
     * @param {string} field
     * @param {T[]} items
     * @return {T[]}
     */
    static innerMerge(field, items)
    {
        /**@type {Map<string, T>}*/
        const tmpmap = new Map();
        switch (field)
        {
            case "zans":
            case "zanarts":
                for (let i = 0; i < items.length; ++i)
                {
                    const zan = items[i];
                    const id = zan.from + "," + zan.to;
                    const last = tmpmap.get(id);
                    if (last == null)
                        tmpmap.set(id, zan);
                    else if (last.time === -1)
                        last.time = zan.time;
                }
                break;
            case "topics":
            case "spams":
                return items;//skip
            default:
                for (let i = 0; i < items.length; ++i)
                {
                    const item = items[i];
                    const id = item.id;
                    const last = tmpmap.get(id);
                    if (last != null)
                    {
                        const entries = Object.entries(last);
                        for (let i = 0; i < entries.length; ++i)
                        {
                            const [key, val] = entries[i];
                            if (val === -1 || val === null)
                                last[key] = item[key];
                        }
                    }
                    else
                        tmpmap.set(id, item);
                }
        }
        return Array.from(tmpmap.values());
    }
    selfMerge()
    {
        const ret = new StandardDB();
        ret.zans = StandardDB.innerMerge("zans", this.zans);
        ret.zanarts = StandardDB.innerMerge("zanarts", this.zanarts);
        ret.users = StandardDB.innerMerge("users", this.users);
        ret.answers = StandardDB.innerMerge("answers", this.answers);
        ret.articles = StandardDB.innerMerge("articles", this.articles);
        ret.questions = StandardDB.innerMerge("questions", this.questions);
        ret.topics = StandardDB.innerMerge("topics", this.topics);
        return ret;
    }
    /**
     * @param {StandardDB} other
     */
    add(other)
    {
        this.zans.push(...other.zans);
        this.zanarts.push(...other.zanarts);
        this.users.push(...other.users);
        this.answers.push(...other.answers);
        this.articles.push(...other.articles);
        this.questions.push(...other.questions);
        this.topics.push(...other.topics);
    }
}

/**
 * @typedef { Object } UserType
 * @property { string } avatarUrl
 * @property { string } avatar_url
 * @property { {id: string, template: string} } avatar
 * @property { [] } badge
 * @property { number } gender
 * @property { string } headline
 * @property { string } id
 * @property { boolean } isFollowed
 * @property { boolean } isFollowing
 * @property { boolean } isOrg
 * @property { string } name
 * @property { string } type
 * @property { string } url
 * @property { string } urlToken
 * @property { string } url_token
 * @property { string } slug
 * @property { string } userType
 * @property { { name: string, expiredAt: number }[]= } accountStatus optional
 * @property { number= } answerCount optional
 * @property { number= } answer_count optional
 * @property { number= } followerCount optional
 * @property { number= } follower_count optional
 * @property { number= } articlesCount optional
 * @property { number= } articles_count optional
 * @property { string= } description optional
 * @property { number= } uid optional
 * @property { number= } thankedCount optional
 * @property { number= } thanked_count optional
 * @property { number= } visitsCount optional
 * @property { number= } visits_count optional
 */
/**
 * @typedef {{actionText: string, actor: object, createdTime: number, id: string, target: {id: number, schema: string}, type: string, verb: string}} Activity
 * @typedef {{answerCount: number, author: UserType, boundTopicIds: number[], commentCount: number, created: number, followerCount: number, createdTime: number, id: number, isFollowing: boolean, title: string, type: string, url: string}} QuestType
 * @typedef {{author: UserType, canComment: {reason: string, status: boolean}, commentCount: number, commentPermission: string, content: string, createdTime: number, excerpt: string, excerptNew: string, id: number, isCopyable: boolean, question: QuestType, thanksCount: number, type: "answer", updatedTime: number, url: string, voteupCount: number}} AnswerType
 * @typedef {{author: UserType, commentCount: number, commentPermission: string, content: string, created: number, excerpt: string, excerptNew: string, excerptTitle: string, id: number, imageUrl: string, title: string, type: "article", updated: number, url: string, voteupCount: number, voting: number}} ArticleType
 * @typedef {{avatarUrl: string, excerpt: string, followersCount: number, id: string, introduction: string, isFollowing: boolean, name: string, type: "topic", url: string}} TopicType
 * @typedef {Object} Entities
 * @property {{[id:string]: Activity}} activities
 * @property {{[id:string]: AnswerType}} answers
 * @property {{[id:string]: ArticleType}} articles
 * @property {{[id:string]: UserType}} users
 * @property {{[id:string]: QuestType}} questions
 * @property {{[id:string]: TopicType}} topics
 */

class APIParser
{
    /**
     * @param {{}} output
     * @param {{type: string, [x:string]: any}} obj
     * @returns {User | Answer | Question}
     */
    static parseByType(output, obj)
    {
        if (!obj.type)
            return null;
        switch (obj.type)
        {
            case "question":
                {
                    let tpids = undefined;
                    if (obj.topics instanceof Array)
                    {
                        const tps = obj.topics.map(t => new Topic(t.id, t.name));
                        output.topics.push(...tps);
                        if (tps.length > 0)
                            tpids = tps.mapToProp("id");
                    }
                    const qst = new Question(obj.id, obj.title, tpids, obj.created);
                    output.questions.push(qst);
                    if (qst.author)
                        APIParser.parseByType(output, qst.author);
                    return qst;
                }
            case "answer":
                {
                    const qst = APIParser.parseByType(output, obj.question);
                    const ath = APIParser.parseByType(output, obj.author);
                    const qid = qst.id; const aid = ath.id;
                    /**@type {string}*/
                    let excerpt = obj.excerptNew || obj.excerpt_new;
                    if (!excerpt && obj.excerpt)
                        excerpt = obj.excerpt.replace(/<[^>]+>/g, "");//remove html tags
                    const ans = new Answer(obj.id, qid, aid, _any(obj.voteup_count, obj.voteupCount), excerpt,
                        _any(obj.created_time, obj.createdTime), _any(obj.updated_time, obj.updatedTime));
                    output.answers.push(ans);
                    return ans;
                }
            case "people":
                {
                    const user = User.fromRawJson(obj);
                    output.users.push(user);
                    return user;
                }
            case "article":
                {
                    const ath = APIParser.parseByType(output, obj.author);
                    let timeC = obj.created, timeU = obj.updated;
                    if (timeC == null && obj.publishedTime)
                        timeC = Date.parse(obj.publishedTime).toUTCSeconds();
                    if (typeof (timeU) === "string")
                        timeU = Date.parse(timeU).toUTCSeconds();
                    const art = new Article(obj.id, obj.title, ath.id, _any(obj.voteup_count, obj.voteupCount),
                        _any(obj.excerpt_new, obj.excerptNew), timeC, timeU);
                    output.articles.push(art);
                    return art;
                }
        }
    }

    /**
     * @param {Entities} data
     */
    static parseEntities(data)
    {
        const output = new StandardDB();
        /**@type {Activity[]}*/
        const acts = Object.values(data.activities);
        for (let i = 0; i < acts.length; ++i)
        {
            const act = acts[i];
            if (act.verb === "ANSWER_VOTE_UP")
                output.zans.push(new Zan(act.actor.urlToken, act.target.id, act.createdTime));
            else if (act.verb === "MEMBER_VOTEUP_ARTICLE")
                output.zanarts.push(new Zan(act.actor.urlToken, act.target.id, act.createdTime));
        }

        Object.values(data.users).forEach(/**@param {UserType} usr*/(usr) => APIParser.parseByType(output, usr));
        Object.values(data.answers).forEach(/**@param {AnswerType} ans*/(ans) => APIParser.parseByType(output, ans));
        Object.values(data.questions).forEach(/**@param {QuestType} qst*/(qst) => APIParser.parseByType(output, qst));
        Object.values(data.articles).forEach(/**@param {ArticleType} art*/(art) => APIParser.parseByType(output, art));
        return output;
    }

    /**
     * @param {Activity[]} acts
     */
    static parsePureActivities(acts)
    {
        const output = new StandardDB();
        acts.forEach(act =>
        {
            switch (act.verb)
            {
                case "TOPIC_FOLLOW":
                    output.topics.push(new Topic(act.target.id, act.target.name));
                    break;
                case "QUESTION_FOLLOW":
                    APIParser.parseByType(output, act.target);
                    break;
                case "ANSWER_CREATE":
                case "MEMBER_CREATE_ARTICLE":
                    APIParser.parseByType(output, act.target);
                    break;
                case "MEMBER_COLLECT_ANSWER":
                case "MEMBER_COLLECT_ARTICLE":
                    APIParser.parseByType(output, act.target);
                    break;
                case "ANSWER_VOTE_UP":
                    {
                        const ans = APIParser.parseByType(output, act.target);
                        output.zans.push(new Zan(act.actor.url_token, ans, act.created_time));
                    } break;
                case "MEMBER_VOTEUP_ARTICLE":
                    {
                        const art = APIParser.parseByType(output, act.target);
                        output.zanarts.push(new Zan(act.actor.url_token, art, act.created_time));
                    } break;
            }
        });
        return output;
    }
}