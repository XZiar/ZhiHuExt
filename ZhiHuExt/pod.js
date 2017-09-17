"use strict"

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
            else if (statuss.find(x => x.name === "ban" && x.expiredAt < x.createdAt))
                user.status = "sban";//shutup-ban
            else
                user.status = "";
        }
        return user;
    }
    static fromRawJson2(theuser)
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
    constructor(id, title, topic)
    {
        this.id = id + "";
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

class Topic
{
    constructor(id, name)
    {
        this.id = "" + id;
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
    constructor(data)
    {
        this.id = "";
        this.question = "";
        this.author = "";
        this.zancnt = 0;
        this.assign(data);
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
    constructor(user, answer)
    {
        this.from = user.id;
        if (answer instanceof Answer)
            this.to = answer.id;
        else
            this.to = "" + answer;
    }
}