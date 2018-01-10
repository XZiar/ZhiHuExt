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
        this.loc = null;
        this.hl = null;
        this.des = null;
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
        const statuss = theuser.accountStatus || theuser.account_status;
        if (statuss)
        {
            if (statuss.find(x => x.name === "hang" || x.name === "lock"))
                user.status = "ban";
            else if (statuss.find(x => x.name === "ban" && (x.expiredAt === 864000000 || x.expiredAt > 1700000000)))
                user.status = "sban";//shutup-ban
            else
                user.status = "";
        }
        if (theuser.locations instanceof Array && theuser.locations.length > 0)
            user.loc = theuser.locations[0].name;
        if (theuser.headline)
            user.hl = theuser.headline;
        if (theuser.description)
            user.des = theuser.description;
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

class ADetail
{
    constructor(id, content)
    {
        this.id = Number(id);
        this.content = content;
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

class Follow
{
    /**
     * @param {User | string} from
     * @param {User | string} to
     */
    constructor(from, to)
    {
        this.from = typeof (from) === "string" ? from : from.id;
        this.to = typeof (to) === "string" ? to : to.id;
    }
}

class StandardDB
{
    constructor()
    {
        /**@type {User[]} users*/
        this.users = [];
        /**@type {Follow[]} follows*/
        this.follows = [];
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
        /**@type {ADetail[]} details*/
        this.details = [];
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
            case "follows":
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
        ret.details = StandardDB.innerMerge("details", this.details);
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
        this.details.push(...other.details);
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
 * @typedef {{reason_type: string, reason_id: number, object_token: string, reason_text: string, object_type: string}} UninterestReason
 * @typedef {{actionText: string, actor: object, createdTime: number, id: string, target: {id: number, schema: string}, type: string, verb: string}} Activity
 * @typedef {{answerCount: number, author: UserType, boundTopicIds: number[], commentCount: number, created: number, followerCount: number, createdTime: number, id: number, isFollowing: boolean, title: string, type: string, url: string}} QuestType
 * @typedef {{author: UserType, canComment: {reason: string, status: boolean}, commentCount: number, commentPermission: string, content: string, createdTime: number, excerpt: string, excerptNew: string, id: number, isCopyable: boolean, question: QuestType, thanksCount: number, type: "answer", updatedTime: number, url: string, voteupCount: number}} AnswerType
 * @typedef {{author: UserType, commentCount: number, commentPermission: string, content: string, created: number, excerpt: string, excerptNew: string, excerptTitle: string, id: number, imageUrl: string, title: string, type: "article", updated: number, url: string, voteupCount: number, voting: number}} ArticleType
 * @typedef {{avatarUrl: string, excerpt: string, followersCount: number, id: string, introduction: string, isFollowing: boolean, name: string, type: "topic", url: string}} TopicType
 * @typedef {{count: number, target: {id: number, schema: string}, updatedTime: number, uninterestReasons: UninterestReason[], verb: string, actors: UserType[], createdTime: number, type: "feed", attachedInfo: string}} FeedType
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
     * @param {StandardDB} output
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
                    if (obj.author instanceof Object)
                    {
                        APIParser.parseByType(output, obj.author);
                    }
                    const title = _any(obj.title, obj.name);//.replace(/<\/?em>/g, "");
                    const qst = new Question(obj.id, title, tpids, obj.created);
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
                    {
                        if (obj.attached_info_bytes != null)//from search, use content instead
                            excerpt = obj.content.replace(/<[^>]+>/g, "");
                        else
                            excerpt = obj.excerpt.replace(/<[^>]+>/g, "");//remove html tags
                    }
                    const ans = new Answer(obj.id, qid, aid, _any(obj.voteup_count, obj.voteupCount), excerpt,
                        _any(obj.created_time, obj.createdTime), _any(obj.updated_time, obj.updatedTime));
                    if (obj.content)
                    {
                        const det = new ADetail(ans.id, obj.content);
                        output.details.push(det);
                    }
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
                    let timeC = _any(obj.created_time, obj.createdTime, obj.created), timeU = _any(obj.updated_time, obj.updatedTime, obj.updated);
                    if (timeC == null && obj.publishedTime)
                        timeC = Date.parse(obj.publishedTime) / 1000;
                    if (typeof (timeU) === "string")
                        timeU = Date.parse(timeU) / 1000;
                    /**@type {string}*/
                    let excerpt = obj.excerptNew || obj.excerpt_new;
                    if (!excerpt && obj.excerpt)
                    {
                        if (obj.attached_info_bytes != null)//from search, use content instead
                            excerpt = obj.content.replace(/<[^>]+>/g, "");
                        else
                            excerpt = obj.excerpt.replace(/<[^>]+>/g, "");//remove html tags
                    }
                    const art = new Article(obj.id, obj.title, ath.id, _any(obj.voteup_count, obj.voteupCount), excerpt, timeC, timeU);
                    if (obj.content)
                    {
                        const det = new ADetail(-art.id, obj.content);
                        output.details.push(det);
                    }
                    output.articles.push(art);
                    if (obj.upvoted_followees instanceof Array)
                        obj.upvoted_followees.forEach(x => output.zanarts.push(new Zan(APIParser.parseByType(output, x), obj.id)));
                    return art;
                }
            case "topic":
                {
                    const topic = new Topic(obj.id, obj.name);
                    output.topics.push(topic);
                    return topic;
                }
        }
    }

    /**
     * @param {StandardDB} output
     * @param {UninterestReason[]} reasons
     */
    static parseReasons(output, reasons)
    {
        reasons.forEach(ur =>
        {
            if (ur.reason_type === "topic" && ur.object_type === "topic")
                output.topics.push(new Topic(ur.object_token, ur.reason_text));
        });
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
        Object.values(data.feeds).forEach(/**@param {FeedType} feed*/(feed) =>
        {
            switch (feed.verb)
            {
                case "ANSWER_VOTE_UP":
                case "MEMBER_VOTEUP_ANSWER":
                    {
                        const ans = feed.target.id;
                        const actor = feed.actors[0];
                        output.zans.push(new Zan(actor.urlToken, ans, feed.createdTime));
                    } break;
                case "MEMBER_VOTEUP_ARTICLE":
                    {
                        const art = feed.target.id;
                        const actor = feed.actors[0];
                        output.zanarts.push(new Zan(actor.urlToken, art, feed.createdTime));
                    } break;
            }
            if (feed.uninterestReasons instanceof Array)
                APIParser.parseReasons(output, feed.uninterestReasons);
        });
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
                    APIParser.parseByType(output, act.target);
                    break;
                case "QUESTION_CREATE":
                case "QUESTION_FOLLOW":
                case "MEMBER_FOLLOW_QUESTION":
                    APIParser.parseByType(output, act.target);
                    break;
                case "ANSWER_CREATE":
                case "MEMBER_ANSWER_QUESTION":
                case "MEMBER_CREATE_ARTICLE":
                    APIParser.parseByType(output, act.target);
                    break;
                case "MEMBER_COLLECT_ANSWER":
                case "MEMBER_COLLECT_ARTICLE":
                case "TOPIC_ACKNOWLEDGED_ANSWER":
                case "TOPIC_ACKNOWLEDGED_ARTICLE":
                    APIParser.parseByType(output, act.target);
                    break;
                case "ANSWER_VOTE_UP":
                case "MEMBER_VOTEUP_ANSWER":
                    {
                        const ans = APIParser.parseByType(output, act.target);
                        const actor = act.actor || act.actors[0];
                        output.zans.push(new Zan(_any(actor.url_token, actor.urlToken), ans, _any(act.created_time, act.createdTime)));
                    } break;
                case "MEMBER_VOTEUP_ARTICLE":
                    {
                        const art = APIParser.parseByType(output, act.target);
                        const actor = act.actor || act.actors[0];
                        output.zanarts.push(new Zan(_any(actor.url_token, actor.urlToken), art, _any(act.created_time, act.createdTime)));
                    } break;
                default:
                    console.log("unknown verb", act.verb, act);
            }
            if (act.uninterest_reasons instanceof Array)
                APIParser.parseReasons(output, act.uninterest_reasons);
        });
        return output;
    }
}