import { Fragment, ReactNode } from "react"
import { Link, useLocation } from "@tanstack/react-router"
import { useStudyDomains } from "@/features/study-domain"

const homeIcon = (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
  </svg>
)

const studyIcon = (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
  </svg>
)

const noteIcon = (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
  </svg>
)

type NavItem = {
  to: string
  label: string
  icon: ReactNode
  isActive: (pathname: string) => boolean
}

const searchIcon = (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
  </svg>
)

type BottomNavProps = {
  onSearchClick?: () => void
}

export const BottomNav = ({ onSearchClick }: BottomNavProps) => {
  const location = useLocation()
  const { studyDomains } = useStudyDomains()

  // 学習領域が1つなら直接その科目一覧へ、複数または0なら領域選択へ
  const studyTo =
    studyDomains.length === 1
      ? `/domains/${studyDomains[0].id}/subjects`
      : "/domains"

  const navItems: NavItem[] = [
    {
      to: "/",
      label: "ホーム",
      icon: homeIcon,
      isActive: (p) => p === "/",
    },
    {
      to: studyTo,
      label: "学習",
      icon: studyIcon,
      isActive: (p) => p.startsWith("/subjects") || p.startsWith("/domains"),
    },
    {
      to: "/notes",
      label: "ノート",
      icon: noteIcon,
      isActive: (p) => p.startsWith("/notes"),
    },
  ]

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 glass border-t border-ink-100 safe-area-pb">
      <ul className="flex justify-around py-2">
        {navItems.map((item, index) => {
          const active = item.isActive(location.pathname)

          return (
            <Fragment key={item.to}>
              <li className="flex-1">
                <Link
                  to={item.to}
                  className={`flex flex-col items-center gap-1 py-2 px-3 rounded-xl mx-1 transition-all duration-200 ${
                    active
                      ? "text-indigo-600 bg-indigo-50"
                      : "text-ink-400 hover:text-ink-600"
                  }`}
                >
                  <span className={active ? "scale-110 transition-transform" : ""}>
                    {item.icon}
                  </span>
                  <span className={`text-2xs font-medium ${active ? "text-indigo-600" : ""}`}>
                    {item.label}
                  </span>
                </Link>
              </li>
              {index === 1 && (
                <li key="search" className="flex-1">
                  <button
                    type="button"
                    onClick={onSearchClick}
                    className="flex flex-col items-center gap-1 py-2 px-3 rounded-xl mx-1 transition-all duration-200 text-ink-400 hover:text-ink-600 w-full"
                  >
                    <span>{searchIcon}</span>
                    <span className="text-2xs font-medium">論点検索</span>
                  </button>
                </li>
              )}
            </Fragment>
          )
        })}
      </ul>
    </nav>
  )
}
