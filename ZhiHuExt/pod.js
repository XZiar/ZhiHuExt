class User
{
    constructor(data)
    {
        this.id = "";
        this.name = "";
        this.head = "";
        this.anscnt = 0;
        this.articlecnt = 0;
        this.followcnt = 0;
        this.assign(data);
    }

    assign(data)
    {
        Object.assign(this, data);
    }

    static assigns(array)
    {
        if (array instanceof Array)
            return array.map(dat => new User(dat));
        else
            return [new User(dat)];
    }
}

class Question
{
    constructor(id, title, topic)
    {
        this.id = id + "";
        this.title = title;
        if (topic instanceof Array)
            this.topics = topic;
        else
            this.topics = [topic];
    }
}

class Topic
{
    constructor(id, name)
    {
        this.id = id;
        this.name = name;
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

    static assigns(array)
    {
        if (array instanceof Array)
            return array.map(dat => new Answer(dat));
        else
            return [new Answer(dat)];
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
            this.to = answer;
    }
}