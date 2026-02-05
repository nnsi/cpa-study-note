import { Check, Image as ImageIcon } from "lucide-react"
import type { ExerciseWithImage } from "@cpa-study/shared/schemas"

type ExerciseListProps = {
  exercises: ExerciseWithImage[]
  onExerciseClick?: (exerciseId: string) => void
  getImageUrl: (imageId: string) => string
}

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
}

export const ExerciseList = ({
  exercises,
  onExerciseClick,
  getImageUrl,
}: ExerciseListProps) => {
  if (exercises.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-ink-500">
        <ImageIcon className="h-12 w-12 mb-2 opacity-50" />
        <p>まだ問題がありません</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-500">解いた問題 ({exercises.length}件)</p>

      {exercises.map((exercise) => (
        <button
          key={exercise.exerciseId}
          onClick={() => onExerciseClick?.(exercise.exerciseId)}
          className="flex items-start gap-3 p-3 rounded-lg border border-ink-200 hover:border-ink-300 hover:bg-ink-50 transition-all text-left"
        >
          {/* サムネイル */}
          <div className="flex-shrink-0 w-12 h-12 rounded bg-ink-100 overflow-hidden">
            <img
              src={getImageUrl(exercise.imageId)}
              alt="問題画像"
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>

          {/* コンテンツ */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs text-ink-500">{formatDate(exercise.createdAt)}</span>
              {exercise.markedAsUnderstood && (
                <span className="flex items-center gap-1 text-xs text-jade-600">
                  <Check className="h-3 w-3" />
                  理解済み
                </span>
              )}
            </div>
            {exercise.ocrText && (
              <p className="text-sm text-ink-700 line-clamp-2 mt-1">
                {exercise.ocrText}
              </p>
            )}
          </div>
        </button>
      ))}
    </div>
  )
}
