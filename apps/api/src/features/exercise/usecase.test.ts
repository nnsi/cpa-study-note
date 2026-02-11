/**
 * Exercise UseCase のテスト
 */
import { describe, it, expect, vi } from "vitest"
import type { ExerciseRepository, Exercise, ExerciseWithImage, TopicForSuggestion } from "./repository"
import type { ImageRepository, Image } from "../image/repository"
import type { AIAdapter, AIConfig } from "@/shared/lib/ai"
import { confirmExercise, getTopicExercises } from "./usecase"

// テストデータ
const createMockDate = (offset = 0) => new Date(Date.now() + offset)

const createMockExercise = (overrides: Partial<Exercise> = {}): Exercise => ({
  id: "exercise-1",
  userId: "user-1",
  imageId: "image-1",
  topicId: null,
  suggestedTopicIds: ["topic-1"],
  markedAsUnderstood: false,
  createdAt: createMockDate(),
  confirmedAt: null,
  ...overrides,
})

const createMockExerciseWithImage = (overrides: Partial<ExerciseWithImage> = {}): ExerciseWithImage => ({
  exerciseId: "exercise-1",
  imageId: "image-1",
  ocrText: "問1 有価証券の評価損益",
  createdAt: createMockDate(),
  markedAsUnderstood: false,
  ...overrides,
})

// モックリポジトリファクトリ
const createMockExerciseRepo = (overrides: Partial<ExerciseRepository> = {}): ExerciseRepository => ({
  create: vi.fn().mockResolvedValue(createMockExercise()),
  findById: vi.fn().mockResolvedValue(null),
  findByIdWithOwnerCheck: vi.fn().mockResolvedValue(null),
  confirm: vi.fn().mockResolvedValue(null),
  findByTopicId: vi.fn().mockResolvedValue([]),
  findTopicsForSuggestion: vi.fn().mockResolvedValue([]),
  ...overrides,
})

describe("Exercise UseCase", () => {
  describe("confirmExercise", () => {
    it("問題を論点に確定する", async () => {
      const exercise = createMockExercise()
      const confirmed = createMockExercise({
        topicId: "topic-1",
        confirmedAt: createMockDate(),
      })
      const exerciseRepo = createMockExerciseRepo({
        findByIdWithOwnerCheck: vi.fn().mockResolvedValue(exercise),
        confirm: vi.fn().mockResolvedValue(confirmed),
      })

      const result = await confirmExercise(
        { exerciseRepo },
        "user-1",
        "exercise-1",
        "topic-1",
        false
      )

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.exerciseId).toBe("exercise-1")
      expect(result.value.topicId).toBe("topic-1")
      expect(result.value.topicChecked).toBe(false)
      expect(exerciseRepo.confirm).toHaveBeenCalledWith("exercise-1", "topic-1", false)
    })

    it("理解済みマーク付きで確定する", async () => {
      const exercise = createMockExercise()
      const confirmed = createMockExercise({
        topicId: "topic-1",
        markedAsUnderstood: true,
        confirmedAt: createMockDate(),
      })
      const exerciseRepo = createMockExerciseRepo({
        findByIdWithOwnerCheck: vi.fn().mockResolvedValue(exercise),
        confirm: vi.fn().mockResolvedValue(confirmed),
      })

      const result = await confirmExercise(
        { exerciseRepo },
        "user-1",
        "exercise-1",
        "topic-1",
        true
      )

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.topicChecked).toBe(true)
    })

    it("存在しない問題でエラーを返す", async () => {
      const exerciseRepo = createMockExerciseRepo({
        findByIdWithOwnerCheck: vi.fn().mockResolvedValue(null),
      })

      const result = await confirmExercise(
        { exerciseRepo },
        "user-1",
        "non-existent",
        "topic-1",
        false
      )

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe("NOT_FOUND")
    })

    it("既に確定済みの問題でエラーを返す", async () => {
      const confirmedExercise = createMockExercise({
        confirmedAt: createMockDate(),
        topicId: "topic-1",
      })
      const exerciseRepo = createMockExerciseRepo({
        findByIdWithOwnerCheck: vi.fn().mockResolvedValue(confirmedExercise),
      })

      const result = await confirmExercise(
        { exerciseRepo },
        "user-1",
        "exercise-1",
        "topic-2",
        false
      )

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe("BAD_REQUEST")
      expect(result.error.message).toContain("既に確定")
    })

    it("confirm失敗時にエラーを返す", async () => {
      const exercise = createMockExercise()
      const exerciseRepo = createMockExerciseRepo({
        findByIdWithOwnerCheck: vi.fn().mockResolvedValue(exercise),
        confirm: vi.fn().mockResolvedValue(null),
      })

      const result = await confirmExercise(
        { exerciseRepo },
        "user-1",
        "exercise-1",
        "invalid-topic",
        false
      )

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe("BAD_REQUEST")
    })
  })

  describe("getTopicExercises", () => {
    it("論点に紐づく問題一覧を取得する", async () => {
      const exercises = [
        createMockExerciseWithImage(),
        createMockExerciseWithImage({
          exerciseId: "exercise-2",
          imageId: "image-2",
          markedAsUnderstood: true,
        }),
      ]
      const exerciseRepo = createMockExerciseRepo({
        findByTopicId: vi.fn().mockResolvedValue(exercises),
      })

      const result = await getTopicExercises(
        { exerciseRepo },
        "user-1",
        "topic-1"
      )

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.exercises).toHaveLength(2)
      expect(result.value.exercises[0].exerciseId).toBe("exercise-1")
      expect(result.value.exercises[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(result.value.exercises[1].markedAsUnderstood).toBe(true)
    })

    it("問題がない場合は空配列を返す", async () => {
      const exerciseRepo = createMockExerciseRepo({
        findByTopicId: vi.fn().mockResolvedValue([]),
      })

      const result = await getTopicExercises(
        { exerciseRepo },
        "user-1",
        "topic-1"
      )

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.exercises).toEqual([])
    })
  })
})
