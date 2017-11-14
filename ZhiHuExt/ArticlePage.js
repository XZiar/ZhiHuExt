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

    /**
     * 
     * @param {{database: ArtPageDB, me: {alug: string}}} artdata
     */
    function parseData(artdata)
    {
        const artdb = artdata.database;
        const output = APIParser.batch;
        const users = [], articles = [], topics = [], zanarts = [];
        {//process user
            const selfUser = artdata.me.slug;
            const usersEntry = Object.entries(artdb.User);
            for (let i = 0; i < usersEntry.length; ++i)
            {
                const [name, theuser] = usersEntry[i];
                if (name === selfUser)
                    continue;
                const user = User.fromRawJson(theuser);
                output.users.push(user);
                break;
            }
        }
        {
            /**@type {ArtType}*/
            const post = Object.values(artdb.Post)[0];
            output.topics.push(...post.topics.map(t => new Topic(t.id, t.name)));
            const article = new Article(post.slug, post.title, post.author, post.likesCount, post.summary.replace(/<[^>]+>/g, ""),
                Math.floor(Date.parse(post.publishedTime) / 1000), Math.floor(Date.parse(post.updated) / 1000));
            output.articles.push(article);
            post.lastestLikers.forEach(theuser =>
            {
                const user = User.fromRawJson(theuser);
                output.users.push(user);
                output.zanarts.push(new Zan(user, article));
            });

            [post.meta.previous, post.meta.next].filter(p => p != null).forEach(p =>
            {
                const ath = User.fromRawJson(p.author);
                output.users.push(ath);
                output.topics.push(...p.topics.map(t => new Topic(t.id, t.name)));
                const subart = new Article(p.slug, p.title, ath.id, p.likesCount, p.summary.replace(/<[^>]+>/g, ""),
                    Math.floor(Date.parse(p.publishedTime) / 1000));//no updated time
                output.articles.push(subart);
            });
        }
        return output;
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
        const artdata = JSON.parse(txt);
        console.log(artdata);
        const output = parseData(artdata);
        console.log("artpage-report", output);
        ContentBase._report("batch", output);
    });
    obs.observe(document, { "childList": true, "subtree": true });

}()
