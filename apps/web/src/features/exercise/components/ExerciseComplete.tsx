import { CheckCircle } from "lucide-react"

type ExerciseCompleteProps = {
  topicName: string
  onViewTopic: () => void
  onContinue: () => void
}

export const ExerciseComplete = ({
  topicName,
  onViewTopic,
  onContinue,
}: ExerciseCompleteProps) => {
  return (
    <div className="flex flex-col items-center gap-6 p-8">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-jade-100">
        <CheckCircle className="h-8 w-8 text-jade-600" />
      </div>

      <div className="text-center">
        <h2 className="text-xl font-semibold text-ink-900 mb-2">保存しました</h2>
        <p className="text-ink-600">
          「{topicName}」に問題を追加しました
        </p>
      </div>

      <div className="flex gap-3 w-full max-w-xs">
        <button
          onClick={onViewTopic}
          className="flex-1 btn-primary py-2.5"
        >
          論点を見る
        </button>
        <button
          onClick={onContinue}
          className="flex-1 btn-secondary py-2.5"
        >
          続けて追加
        </button>
      </div>
    </div>
  )
}
