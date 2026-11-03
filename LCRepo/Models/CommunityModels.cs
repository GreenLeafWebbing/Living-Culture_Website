namespace LCRepo.Models;

public sealed class MemberState
{
    public bool SignedIn { get; set; }
    public bool IsAdmin { get; set; }
    public string Email { get; set; } = "";
}
public sealed class EventItem
{
    public string Id { get; set; } = "";
    public string Title { get; set; } = "";
    public string Details { get; set; } = "";
    public string Venue { get; set; } = "";
    public DateTimeOffset StartsAt { get; set; }
    public bool IsPublished { get; set; }
}
public sealed class NoticeItem
{
    public string Id { get; set; } = "";
    public string Title { get; set; } = "";
    public string Body { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? ExpiresAt { get; set; }
    public bool IsPublished { get; set; }
}
public sealed class InquiryItem
{
    public string Id { get; set; } = "";
    public string Kind { get; set; } = "";
    public string FullName { get; set; } = "";
    public string Email { get; set; } = "";
    public string Message { get; set; } = "";
    public bool KeepPrivate { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
public sealed class InquiryDraft
{
    public string Kind { get; set; } = "prayer";
    public string FullName { get; set; } = "";
    public string Email { get; set; } = "";
    public string Message { get; set; } = "";
    public bool KeepPrivate { get; set; } = true;
    public bool Consent { get; set; }
}
