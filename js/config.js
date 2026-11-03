// Living Culture – site settings.
// The Supabase "publishable" key is safe to be public. NEVER put a secret/service_role key here.
window.LC_CONFIG = {
  supabaseUrl: "https://pzdszmlbjtcepevweefc.supabase.co",
  supabaseKey: "sb_publishable_RFyj9bTwV9iVg-GOWpgPRA_plWbmcbt",

  // Our weekly gathering (shown automatically on the calendar every week).
  gathering: {
    weekday: 4,          // 0 = Sunday ... 4 = Thursday
    time: "19:00",       // 24-hour time
    durationMinutes: 120,
    title: "Living Culture – Bible Study",
    place: ""            // e.g. "Church hall, 12 Main Road" – leave empty to hide
  }
};
