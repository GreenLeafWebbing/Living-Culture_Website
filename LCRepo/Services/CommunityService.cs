using LCRepo.Models;
using Microsoft.JSInterop;

namespace LCRepo.Services;

/// <summary>
/// Blazor UI calls a minimal JavaScript module to use Supabase Auth and PostgREST.
/// This browser client only has a PUBLIC publishable key; database RLS enforces privileges.
/// </summary>
public sealed class CommunityService(IJSRuntime js) : IAsyncDisposable
{
    private Task<IJSObjectReference>? moduleTask;
    private Task<IJSObjectReference> Module => moduleTask ??= js.InvokeAsync<IJSObjectReference>("import", "./js/lc.js").AsTask();

    public async Task<MemberState> WhoAmIAsync() =>
        await (await Module).InvokeAsync<MemberState>("whoAmI");

    public async Task<string> SignInAsync(string email, string password) =>
        await (await Module).InvokeAsync<string>("signIn", email, password);

    public async Task<string> SignUpAsync(string name, string email, string password) =>
        await (await Module).InvokeAsync<string>("signUp", name, email, password);

    public async Task SignOutAsync() =>
        await (await Module).InvokeVoidAsync("signOut");

    public async Task<List<EventItem>> EventsAsync(bool all = false) =>
        await (await Module).InvokeAsync<List<EventItem>>("getEvents", all);

    public async Task<List<NoticeItem>> NoticesAsync(bool all = false) =>
        await (await Module).InvokeAsync<List<NoticeItem>>("getNotices", all);

    public async Task<List<InquiryItem>> InquiriesAsync() =>
        await (await Module).InvokeAsync<List<InquiryItem>>("getInquiries");

    public async Task AddEventAsync(string title, string details, string venue, DateTimeOffset when) =>
        await (await Module).InvokeVoidAsync("addEvent", title, details, venue, when.ToString("O"));

    public async Task AddNoticeAsync(string title, string body, string? expiryUtc) =>
        await (await Module).InvokeVoidAsync("addNotice", title, body, expiryUtc);

    public async Task DeleteEventAsync(string id) =>
        await (await Module).InvokeVoidAsync("deleteEvent", id);

    public async Task DeleteNoticeAsync(string id) =>
        await (await Module).InvokeVoidAsync("deleteNotice", id);

    public async Task<string> SendInquiryAsync(InquiryDraft draft) =>
        await (await Module).InvokeAsync<string>("sendInquiry", draft);

    public async ValueTask DisposeAsync()
    {
        if (moduleTask is { IsCompletedSuccessfully: true })
        {
            await (await moduleTask).DisposeAsync();
        }
    }
}
