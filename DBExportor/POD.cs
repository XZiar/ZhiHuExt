using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Threading.Tasks;

namespace DBExportor.Pods
{
    public enum SpamType : byte { member, answer, question }
    [Pod("spams")]
    public struct Spam
    {
        public string id { get { return id_; } set { id_ = string.Intern(value); } }
        private string id_;
        public string type { get { return type_.ToString(); } set { type_ = Enum.Parse<SpamType>(value); } }
        private SpamType type_;
    }

    [Pod("follows")]
    public struct Follow
    {
        public string from;
        public string to;
    }

    public enum UserStatus : byte { ban, sban, empty }
    [Pod("users")]
    public struct User
    {
        public string id { get { return id_; } set { id_ = string.Intern(value); } }
        private string id_;
        public string name;
        public string head;
        public string status
        {
            get { return status_ == UserStatus.empty ? "" : status_.ToString(); }
            set { status_ = Enum.TryParse<UserStatus>(value, out var res) ? res : UserStatus.empty; }
        }
        private UserStatus status_;
        public int anscnt;
        public int articlecnt;
        public int followcnt;
    }

    [Pod("questions")]
    public struct Question
    {
        public uint id;
        public string title;
        public int[] topics;
    }

    [Pod("articles")]
    public struct Article
    {
        public uint id;
        public string title;
        public string author { get { return author_; } set { author_ = string.Intern(value); } }
        private string author_;
        public string excerpt;
        public int zancnt;
    }

    [Pod("topics")]
    public struct Topic
    {
        public uint id;
        public string name;
    }

    [Pod("answers")]
    public struct Answer
    {
        public uint id;
        public int question;
        public string author { get { return author_; } set { author_ = string.Intern(value); } }
        private string author_;
        public string excerpt;
        public int zancnt;
    }

    [Pod("zans", "zanarts")]
    public struct Zan
    {
        public string from { get { return from_; } set { from_ = string.Intern(value); } }
        private string from_;
        public uint to;
    }

    [AttributeUsage(AttributeTargets.Struct, AllowMultiple = false)]
    public sealed class PodAttribute : Attribute
    {
        public readonly string[] TableNames;
        public PodAttribute(params string[] tableName)
        {
            TableNames = tableName;
        }
    }

    public static class DBExtensions
    {
        private static readonly Type ListType = typeof(List<>);

        public static readonly Dictionary<string, Tuple<Type, Type>> PodTypeMap =
            Assembly.GetExecutingAssembly().GetTypes()
                .Where(t => t.Namespace == "DBExportor.Pods" && t.IsDefined(typeof(PodAttribute)))
                .SelectMany(t => t.GetCustomAttribute<PodAttribute>().TableNames.Select(name => Tuple.Create(name, t)))
                .ToDictionary(p => p.Item1, p => Tuple.Create(p.Item2, ListType.MakeGenericType(p.Item2)));

        public static bool GetPodType(string key, out Type type, out Type listtype)
        {
            if (!PodTypeMap.TryGetValue(key, out var types))
            {
                type = listtype = null; return false;
            }
            else
            {
                (type, listtype) = types; return true;
            }
        }
    }
}
