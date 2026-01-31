import { createFileRoute, Link } from "@tanstack/react-router"

export const Route = createFileRoute("/terms")({
  component: TermsPage,
})

function TermsPage() {
  return (
    <div className="min-h-[calc(100vh-72px)] px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-ink-500 hover:text-indigo-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            <span>トップに戻る</span>
          </Link>
        </div>

        <article className="card p-8 lg:p-12 animate-fade-in">
          <h1 className="heading-serif text-3xl mb-2">利用規約</h1>
          <p className="text-ink-400 text-sm mb-8">最終更新日: 2025年1月31日</p>

          <div className="prose prose-ink max-w-none space-y-8">
            <section>
              <h2 className="heading-serif text-xl mb-4 text-ink-800">第1条（適用）</h2>
              <p className="text-ink-600 leading-relaxed">
                本規約は、InkTopik（以下「本サービス」）の利用に関する条件を定めるものです。
                ユーザーは本サービスを利用することにより、本規約に同意したものとみなされます。
              </p>
            </section>

            <section>
              <h2 className="heading-serif text-xl mb-4 text-ink-800">第2条（アカウント）</h2>
              <div className="text-ink-600 leading-relaxed space-y-3">
                <p>
                  ユーザーは、本サービスを利用するためにアカウントを作成する必要があります。
                  アカウント情報の管理はユーザー自身の責任において行うものとします。
                </p>
                <p>
                  ユーザーは、アカウントを第三者に譲渡、貸与、または共有することはできません。
                </p>
              </div>
            </section>

            <section>
              <h2 className="heading-serif text-xl mb-4 text-ink-800">第3条（禁止事項）</h2>
              <p className="text-ink-600 leading-relaxed mb-3">
                ユーザーは、本サービスの利用にあたり、以下の行為を行ってはなりません。
              </p>
              <ul className="list-disc list-inside text-ink-600 space-y-2 ml-2">
                <li>法令または公序良俗に違反する行為</li>
                <li>犯罪行為に関連する行為</li>
                <li>本サービスの運営を妨害する行為</li>
                <li>他のユーザーに迷惑をかける行為</li>
                <li>不正アクセスまたはその試み</li>
                <li>本サービスの逆アセンブル、逆コンパイル、リバースエンジニアリング</li>
              </ul>
            </section>

            <section>
              <h2 className="heading-serif text-xl mb-4 text-ink-800">第4条（サービスの変更・停止）</h2>
              <p className="text-ink-600 leading-relaxed">
                運営者は、ユーザーへの事前通知なく、本サービスの内容を変更、追加、または廃止することができます。
                また、システムメンテナンスや不可抗力により、一時的にサービスを停止することがあります。
              </p>
            </section>

            <section>
              <h2 className="heading-serif text-xl mb-4 text-ink-800">第5条（知的財産権）</h2>
              <p className="text-ink-600 leading-relaxed">
                本サービスに関する知的財産権は、運営者または正当な権利を有する第三者に帰属します。
                ユーザーが本サービスに投稿したコンテンツについては、ユーザー自身が権利を保持しますが、
                運営者はサービス提供のために必要な範囲で利用する権利を有します。
              </p>
            </section>

            <section>
              <h2 className="heading-serif text-xl mb-4 text-ink-800">第6条（免責事項）</h2>
              <div className="text-ink-600 leading-relaxed space-y-3">
                <p>
                  運営者は、本サービスの完全性、正確性、有用性、安全性について保証しません。
                  本サービスの利用により生じた損害について、運営者は一切の責任を負いません。
                </p>
                <p>
                  ユーザー間または第三者との間で生じた紛争については、当事者間で解決するものとし、
                  運営者は一切関与しません。
                </p>
              </div>
            </section>

            <section>
              <h2 className="heading-serif text-xl mb-4 text-ink-800">第7条（規約の変更）</h2>
              <p className="text-ink-600 leading-relaxed">
                運営者は、必要に応じて本規約を変更することができます。
                変更後の規約は、本サービス上に掲載した時点から効力を生じるものとします。
              </p>
            </section>

            <section>
              <h2 className="heading-serif text-xl mb-4 text-ink-800">第8条（AI機能の利用）</h2>
              <div className="text-ink-600 leading-relaxed space-y-3">
                <p>
                  本サービスでは、学習支援のためにAI（人工知能）機能を提供しています。
                  AI機能による回答は参考情報であり、その正確性、完全性、最新性を保証するものではありません。
                </p>
                <p>
                  ユーザーは、AI機能の出力を最終的な判断の根拠とせず、
                  必要に応じて公式教材や専門家の助言を参照するものとします。
                </p>
              </div>
            </section>

            <section>
              <h2 className="heading-serif text-xl mb-4 text-ink-800">第9条（退会・アカウント削除）</h2>
              <div className="text-ink-600 leading-relaxed space-y-3">
                <p>
                  ユーザーは、設定画面から退会手続きを行うことで、いつでもアカウントを削除できます。
                </p>
                <p>
                  ユーザーのアカウントおよび関連データは、退会後30日以内に削除されます。
                  ただし、法令に基づき保存が義務付けられるデータ、または運営上必要なデータ
                  （取引履歴等）については、必要な期間保存することがあります。
                </p>
                <p>
                  削除されたデータは復元できません。
                  ユーザーは退会前に必要なデータを自身でバックアップするものとします。
                </p>
              </div>
            </section>

            <section>
              <h2 className="heading-serif text-xl mb-4 text-ink-800">第10条（反社会的勢力の排除）</h2>
              <div className="text-ink-600 leading-relaxed space-y-3">
                <p>
                  ユーザーは、自らが暴力団、暴力団員、暴力団関係企業、その他の反社会的勢力
                  （以下「反社会的勢力」）に該当しないこと、および反社会的勢力と関係を
                  有しないことを表明し、保証します。
                </p>
                <p>
                  運営者は、ユーザーが反社会的勢力に該当すると判明した場合、または該当する
                  疑いがあると合理的に判断した場合、事前の通知なくアカウントを停止または
                  削除することができます。
                </p>
              </div>
            </section>

            <section>
              <h2 className="heading-serif text-xl mb-4 text-ink-800">第11条（準拠法・管轄）</h2>
              <p className="text-ink-600 leading-relaxed">
                本規約の解釈は日本法に準拠し、本サービスに関する紛争については、
                東京地方裁判所を第一審の専属的合意管轄裁判所とします。
              </p>
            </section>
          </div>
        </article>
      </div>
    </div>
  )
}
