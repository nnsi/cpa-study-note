import { Link, useLocation } from "@tanstack/react-router"

const navItems = [
  { to: "/", label: "ホーム", icon: "🏠" },
  { to: "/subjects", label: "論点", icon: "📚" },
  { to: "/notes", label: "ノート", icon: "📝" },
]

export const BottomNav = () => {
  const location = useLocation()

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t">
      <ul className="flex justify-around">
        {navItems.map((item) => {
          const isActive =
            item.to === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.to)

          return (
            <li key={item.to} className="flex-1">
              <Link
                to={item.to}
                className={`flex flex-col items-center py-2 ${
                  isActive ? "text-blue-600" : "text-gray-500"
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="text-xs mt-1">{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
