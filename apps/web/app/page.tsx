import { Footer } from "@/components/footer";
import { HomeNav } from "@/components/home-nav";
import { HomeSearch } from "@/components/home-search";
import { NotificationBell } from "@/components/notification-bell";
import { UpcomingReleasesWidget } from "@/components/upcoming-releases-widget";
import { UserProfile } from "@/components/user-profile";

// ISR: Revalidate every hour (releases widget data)
export const revalidate = 3600;

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground font-mono relative">
      {/* Screen flicker */}
      <div className="screen-flicker" />

      {/* Centered nav links */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 sm:top-4 z-20">
        <HomeNav />
      </div>

      {/* User profile & notifications - top right */}
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 flex items-center gap-2">
        <NotificationBell />
        <UserProfile />
      </div>

      {/* Content */}
      <main className="relative z-10 min-h-screen flex flex-col">
        {/* Main content - centered */}
        <div
          className="flex-1 flex flex-col items-center justify-center"
          style={{ paddingTop: "6rem", paddingBottom: "6rem" }}
        >
          <HomeSearch />

          {/* Upcoming releases widget */}
          <div className="w-full max-w-3xl px-4 sm:px-0">
            <UpcomingReleasesWidget limit={20} variant="carousel" />
          </div>
        </div>

        <Footer />
      </main>
    </div>
  );
}
