"use strict"

/**
 * @typedef {Object} ArtType
 * @property {string} title
 * @property {string} slug
 * @property {string} author
 * @property {string} content
 * @property {string} updated
 * @property {string} summary
 * @property {number} commentCount
 * @property {number} collapsedCount
 * @property {number} likeCount
 * @property {{url: string, id: string, name: string}[]} topics
 * @property {UserType[]} lastestLikers
 * @property {{previous: ArtType, next: ArtType}} meta
 */
/**
 * @typedef {Object} ArtPageDB
 * @property {{[id:string]: ArtType}} Post
 * @property {{[id:string]: UserType}} User
 * @property {{}} Comment
 * @property {{}} favlists
 */

!function ()
{
    console.log("article page");
    /**
     * @param {any} records
     * @returns {HTMLTextAreaElement=}
     */
    function rootFinder(records)
    {
        for (let i = 0; i < records.length; ++i)
        {
            const record = records[i];
            if (record.type != "childList")
                continue;
            const nodes = record.addedNodes;
            for (let j = 0; j < nodes.length; ++j)
            {
                const node = nodes[j];
                if (!(node instanceof Element)) 
                    continue;
                if (node.id === "preloadedState")
                    return node;
                const obj = node.querySelector("#preloadedState");
                if (obj)
                    return obj;
            }
        }
        return null;
    }

    const obs = new MutationObserver(records =>
    {
        if (document.body == null)
            return;
        const obj = rootFinder(records);
        if (!obj)
            return;
        obs.disconnect();
        let txt = obj.innerText;
        {
            const part = txt.split("new Date(");
            txt = part[0] + part[1].replace(")", "");
        }
        /**@type {{database: ArtPageDB, me: {alug: string}}}*/
        const artdata = JSON.parse(txt);
        const artdb = artdata.database;
        console.log(artdb);
        const users = [], articles = [], topics = [], zanarts = [];
        {//process user
            const selfUser = artdata.me.slug;
            const usersEntry = Object.entries(artdb.User);
            for (let i = 0; i < usersEntry.length; ++i)
            {
                const [name, theuser] = usersEntry[i];
                if (name === selfUser)
                    continue;
                const user = User.fromArticleJson(theuser);
                users.push(user);
                break;
            }
        }
        {
            /**@type {ArtType}*/
            const post = Object.values(artdb.Post)[0];
            const tmpdiv = document.createElement("div");
            topics.push(...post.topics.map(t => new Topic(t.id, t.name)))
            tmpdiv.innerHTML = post.summary;
            const article = new Article(post.slug, post.title, post.author, tmpdiv.innerText, post.likeCount);
            articles.push(article);
            post.lastestLikers.forEach(theuser =>
            {
                const user = User.fromArticleJson(theuser);
                users.push(user);
                zanarts.push(new Zan(user, article));
            });

            [post.meta.previous, post.meta.next].forEach(p =>
            {
                const ath = User.fromArticleJson(p.author);
                users.push(ath);
                tmpdiv.innerHTML = p.summary;
                const subart = new Article(p.slug, p.title, ath.id, tmpdiv.innerText);
                articles.push(subart);
            });
        }
        const report = { users: users, topics: topics, articles: articles, zanarts: zanarts };
        console.log("artpage-report", report);
        ContentBase._report("batch", report);
    });
    obs.observe(document, { "childList": true, "subtree": true });

}()
