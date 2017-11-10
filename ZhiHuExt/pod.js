"use strict"

class User
{
    constructor()
    {
        this.id = "";
        this.name = "";
        this.head = "";
        this.status = null;
        this.anscnt = -1;
        this.articlecnt = -1;
        this.followcnt = -1;
    }

    /**@param {UserType} theuser*/
    static fromRawJson(theuser)
    {
        const user = new User();
        user.id = _any(theuser.urlToken, theuser.url_token, "");//empty=>anomonyous
        user.name = theuser.name;
        user.head = _any(theuser.avatarUrl, theuser.avatar_url).split("/").pop().replace(/_[\w]*.[\w]*$/, "");
        user.anscnt = _any(theuser.answerCount, theuser.answer_count, -1);
        user.followcnt = _any(theuser.followerCount, theuser.follower_count, -1);
        user.articlecnt = _any(theuser.articlesCount, theuser.articles_count, -1);
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
        return user;
    }
    static fromArticleJson(theuser)
    {
        const user = new User();
        user.id = theuser.slug;;
        user.name = theuser.name;
        user.head = theuser.avatar.id;
        if (theuser.answer_count)
            user.anscnt = theuser.answer_count;
        user.status = theuser.isBanned ? "sban" : "";
        return user;
    }
    static fromAnsVoterJson(theuser)
    {
        const user = new User();
        user.id = theuser.url_token;
        user.name = theuser.name;
        user.head = theuser.avatar_url.split("/").pop().replace(/_[\w]*.[\w]*$/, "");
        if (theuser.answer_count)
            user.anscnt = theuser.answer_count;
        return user;
    }
}

class Question
{
    /**
     * @param {number | string} id
     * @param {string} title
     * @param {number | number[]} [topic]
     */
    constructor(id, title, topic)
    {
        this.id = Number(id);// + "";
        this.title = title;
        if (topic)
        {
            if (topic instanceof Array)
                this.topics = topic;
            else
                this.topics = [topic];
        }
        else
            this.topics = null;
    }
}

class Article
{
    /**
     * @param {number | string} id
     * @param {string} title
     * @param {string} author
     * @param {string} [excerpt]
     * @param {number} [zancnt]
     */
    constructor(id, title, author, excerpt, zancnt)
    {
        this.id = Number(id);
        this.title = title;
        this.author = author;
        this.excerpt = excerpt == null ? "" : excerpt;
        this.zancnt = zancnt == null ? -1 : zancnt;
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
        this.id = Number(id);// + "";
        this.name = name;
    }

    static assigns(data)
    {
        if (data instanceof Array)
            return data.map(dat => new Topic(dat.id, dat.name));
        else
            return [new Topic(data.id, data.name)];
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
     */
    constructor(id, quest, author, zancnt, excerpt)
    {
        this.id = Number(id);// + "";
        this.question = Number(quest);
        this.author = author;//should not be null
        this.zancnt = zancnt == null ? -1 : zancnt;
        this.excerpt = excerpt == null ? null : excerpt;
    }

    assign(data)
    {
        Object.assign(this, data);
    }

    static assigns(data)
    {
        if (data instanceof Array)
            return data.map(dat => new Answer(dat));
        else
            return [new Answer(data)];
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
            this.to = Number(target.id);// + "";
        else
            this.to = Number(target);// + "";
        if (time == null)
            this.time = -1;
        else
            this.time = time;
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
     * @returns {{ users: User[], zans: Zan[], zanarts: Zan[], topics: Topic[], answers: Answer[], questions: Question[], articles: Article[] }}
     */
    static SumType() { return { users: [], zans: [], zanarts: [], topics: [], answers: [], questions: [], articles: [] }; }
    /**
     * @param {Entities} data
     */
    static parseEntities(data)
    {
        const output = APIParser.SumType();
        /**@type {Activity[]}*/
        const acts = Object.values(data.activities);
        const users = [], zans = [], zanarts = [], answers = [], quests = [], articles = [], topics = [];
        for (let i = 0; i < acts.length; ++i)
        {
            const act = acts[i];
            const user = User.fromRawJson(act.actor);
            if (user)
            {
                if (act.verb === "ANSWER_VOTE_UP" && act.target.schema === "answer")
                    output.zans.push(new Zan(user, act.target.id, act.createdTime));
                else if (act.verb === "MEMBER_VOTEUP_ARTICLE" && act.target.schema === "article")
                    output.zanarts.push(new Zan(user, act.target.id, act.createdTime));
            }

        }
        /**@type {AnswerType[]}*/
        const anss = Object.values(data.answers);
        for (let i = 0; i < anss.length; ++i)
        {
            const ans = anss[i];
            const qst = ans.question;
            const ansUser = User.fromRawJson(ans.author);
            if (!_CUR_USER || ansUser.id != _CUR_USER.id)
                output.users.push(ansUser);
            if (qst.author)
                output.users.push(User.fromRawJson(qst.author));

            const quest = new Question(qst.id, qst.title/*, qst.boundTopicIds*/);
            output.questions.push(quest);
            const answer = new Answer(ans.id, quest.id, ansUser.id, ans.voteupCount, ans.excerptNew);
            output.answers.push(answer);
        }
        /**@type {QuestType[]}*/
        const qsts = Object.values(data.questions);
        for (let i = 0; i < qsts.length; ++i)
        {
            const qst = qsts[i];
            if (qst.author)
                output.users.push(User.fromRawJson(qst.author));
            const quest = new Question(qst.id, qst.title);
            output.questions.push(quest);
        }
        /**@type {ArticleType[]}*/
        const arts = Object.values(data.articles);
        for (let i = 0; i < arts.length; ++i)
        {
            const art = arts[i];
            const artUser = User.fromRawJson(art.author);
            if (!_CUR_USER || artUser.id != _CUR_USER.id)
                output.users.push(artUser);

            const article = new Article(art.id, art.title, artUser.id, art.excerptNew, art.voteupCount);
            output.articles.push(article);
        }
        /**@type {TopicType[]}*/
        const tps = Object.values(data.topics);
        for (let i = 0; i < tps.length; ++i)
        {
            const tp = tps[i];
            output.topics.push(new Topic(tp.id, tp.name));
        }
        return output;
    }

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
                    const qst = new Question(obj.id, obj.title);
                    output.questions.push(qst);
                    return qst;
                }
            case "answer":
                {
                    const qst = APIParser.parseByType(output, obj.question);
                    const ath = APIParser.parseByType(output, obj.author);
                    const qid = qst.id;
                    const aid = ath.id;
                    const ans = new Answer(obj.id, qid, aid, obj.voteup_count, _any(obj.excerptNew, obj.excerpt));
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
                    const art = new Article(obj.id, obj.title, ath.id, obj.excerpt_new, obj.voteup_count);
                    output.articles.push(art);
                    return art;
                }
        }
    }

    /**
     * @param {Activity[]} acts
     */
    static parsePureActivities(acts)
    {
        const output = APIParser.SumType();
        acts.forEach(act =>
        {
            switch (act.verb)
            {
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