"use strict"

/**
 * @typedef { Object } UserType
 * @property { string } avatarUrl
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
 * @property { string } slug
 * @property { string } userType
 * @property { { name: string, expiredAt: number }[]= } accountStatus optional
 * @property { number= } answerCount optional
 * @property { number= } followerCount optional
 * @property { number= } articlesCount optional
 * @property { string= } description optional
 * @property { number= } uid optional
 * @property { number= } thankedCount optional
 * @property { number= } visitsCount optional
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


class User
{
    constructor(data)
    {
        this.id = "";
        this.name = "";
        this.head = "";
        this.status = null;
        this.anscnt = -1;
        this.articlecnt = -1;
        this.followcnt = -1;
        this.assign(data);
    }

    assign(data)
    {
        Object.assign(this, data);
    }

    static assigns(data)
    {
        if (data instanceof Array)
            return data.map(dat => new User(dat));
        else
            return [new User(data)];
    }
    /**@param {UserType} theuser*/
    static fromRawJson(theuser)
    {
        const user = new User();
        user.id = theuser.urlToken;
        user.name = theuser.name;
        user.head = theuser.avatarUrl.split("/").pop().replace(/_[\w]*.[\w]*$/, "");
        if (theuser.answerCount)
            user.anscnt = theuser.answerCount;
        if (theuser.followerCount)
            user.followcnt = theuser.followerCount;
        if (theuser.articlesCount)
            user.articlecnt = theuser.articlesCount;
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
     * @param {string} [author]
     * @param {number} [zancnt]
     * @param {string} [excerpt]
     */
    constructor(id, quest, author, zancnt, excerpt)
    {
        this.id = Number(id);// + "";
        this.question = Number(quest);
        this.author = author == null ? null : author;
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
     * @param {User} user
     * @param {string | number | Answer | Article} target
     * @param {number} [time]
     */
    constructor(user, target, time)
    {
        this.from = user.id;
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