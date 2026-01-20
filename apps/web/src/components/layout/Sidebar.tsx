import { Link, useLocation } from "@tanstack/react-router"

const navItems = [
  { to: "/", label: "ホーム", icon: "🏠" },
  { to: "/subjects", label: "論点マップ", icon: "📚" },
  { to: "/notes", label: "ノート", icon: "📝" },
]

export const Sidebar = () => {
  const location = useLocation()

  return (
    <nav className="p-4">
      <ul className="space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.to === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.to)

          return (
            <li key={item.to}>
              <Link
                to={item.to}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
