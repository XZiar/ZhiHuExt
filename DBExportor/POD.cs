using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Threading.Tasks;

namespace DBExportor.Pods
{
    public enum SpamType : byte { member, answer, article, question, badans, badart, badusr }
    public struct Spam
    {
        public string id { get => id_; set => id_ = string.Intern(value); }
        private string id_;
        public string type { get => type_.ToString(); set { type_ = Enum.Parse<SpamType>(value); } }
        private SpamType type_;
    }

    public struct Follow
    {
        public string from { get => from_; set => from_ = string.Intern(value); }
        private string from_;
        public string to { get => to_; set => to_ = string.Intern(value); }
        private string to_;
    }

    public enum UserStatus : byte { ban, sban, empty }
    public struct User
    {
        public string id { get => id_; set => id_ = string.Intern(value); }
        private string id_;
        public string name;
        public string head { get => System.Text.Encoding.UTF8.GetString(head_); set => head_ = System.Text.Encoding.UTF8.GetBytes(value); }
        private byte[] head_;
        public string status
        {
            get => status_ == UserStatus.empty ? "" : status_.ToString();
            set => status_ = Enum.TryParse<UserStatus>(value, out var res) ? res : UserStatus.empty;
        }
        public int anscnt;
        public int artcnt;
        public int zancnt;
        public int follower;
        private UserStatus status_;
    }

    public struct Question
    {
        public uint id;
        public string title;
        public int[] topics;
        public long timeC { get => timeC_ == uint.MaxValue ? -1L : timeC_; set => timeC_ = value == -1 ? uint.MaxValue : (uint)value; }
        private uint timeC_;
    }

    public struct Article
    {
        public uint id;
        public string title;
        public string author { get => author_; set => author_ = string.Intern(value); }
        private string author_;
        public string excerpt;
        public int zancnt;
        public long timeC { get => timeC_ == uint.MaxValue ? -1L : timeC_; set => timeC_ = value == -1 ? uint.MaxValue : (uint)value; }
        private uint timeC_;
        public long timeU { get => timeU_ == uint.MaxValue ? -1L : timeU_; set => timeU_ = value == -1 ? uint.MaxValue : (uint)value; }
        private uint timeU_;
    }

    public struct Topic
    {
        public uint id;
        public string name;
    }

    public struct Answer
    {
        public uint id;
        public int question;
        public string author { get { return author_; } set { author_ = string.Intern(value); } }
        private string author_;
        public string excerpt;
        public int zancnt;
        public long timeC { get => timeC_ == uint.MaxValue ? -1L : timeC_; set => timeC_ = value == -1 ? uint.MaxValue : (uint)value; }
        private uint timeC_;
        public long timeU { get => timeU_ == uint.MaxValue ? -1L : timeU_; set => timeU_ = value == -1 ? uint.MaxValue : (uint)value; }
        private uint timeU_;
    }

    public struct Zan
    {
        public string from { get { return from_; } set { from_ = string.Intern(value); } }
        private string from_;
        public uint to;
        public long time { get => time_ == uint.MaxValue ? -1L : time_; set => time_ = value == -1 ? uint.MaxValue : (uint)value; }
        private uint time_;
    }

    public class StandardDB
    {
        public List<Spam> spams = new List<Spam>();
        public List<Follow> follows = new List<Follow>();
        public List<User> users = new List<User>();
        public List<Question> questions = new List<Question>();
        public List<Article> articles = new List<Article>();
        public List<Topic> topics = new List<Topic>();
        public List<Answer> answers = new List<Answer>();
        public List<Zan> zans = new List<Zan>();
        public List<Zan> zanarts = new List<Zan>();
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

    public class TableInfo
    {
        private readonly FieldInfo Field;
        private readonly PropertyInfo CountProperty;
        public readonly Type ElementType;
        public readonly Type ListType;
        public TableInfo(FieldInfo field)
        {
            Field = field;
            ListType = field.FieldType;
            ElementType = ListType.GetGenericArguments()[0];
            CountProperty = ListType.GetProperty("Count");
        }
        public dynamic GetTable(StandardDB db) => Field.GetValue(db);
        public uint GetCount(dynamic table) => (uint)CountProperty.GetValue(table);
    }

    public static class DBExtensions
    {
        public const string POD_VER = "171115a";

        public static readonly Dictionary<string, TableInfo> PodTypeMap =
            typeof(StandardDB).GetFields().ToDictionary(field => field.Name, field => new TableInfo(field));
    }
}
