import { describe, it, expect } from "vitest"
import {
  noteSchema,
  createNoteRequestSchema,
  updateNoteRequestSchema,
} from "@cpa-study/shared/schemas"
import type { Note, NoteWithTopic, NoteWithTopicDetail } from "./repository"

describe("Note Domain Types", () => {
  describe("Note type (from repository)", () => {
    it("should accept valid Note object", () => {
      const note: Note = {
        id: "note-123",
        userId: "user-123",
        topicId: "topic-123",
        sessionId: "session-123",
        aiSummary: "This session covered depreciation methods...",
        userMemo: "Need to review FIFO vs LIFO",
        keyPoints: ["Depreciation reduces asset value", "Multiple methods exist"],
        stumbledPoints: ["Calculating accumulated depreciation"],
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      expect(note.id).toBe("note-123")
      expect(note.keyPoints).toHaveLength(2)
      expect(note.stumbledPoints).toHaveLength(1)
    })

    it("should accept Note with null sessionId", () => {
      const note: Note = {
        id: "note-124",
        userId: "user-123",
        topicId: "topic-123",
        sessionId: null,
        aiSummary: null,
        userMemo: "Manual note without session",
        keyPoints: [],
        stumbledPoints: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      expect(note.sessionId).toBeNull()
      expect(note.aiSummary).toBeNull()
    })

    it("should accept empty arrays for points", () => {
      const note: Note = {
        id: "note-125",
        userId: "user-123",
        topicId: "topic-123",
        sessionId: null,
        aiSummary: null,
        userMemo: null,
        keyPoints: [],
        stumbledPoints: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      expect(note.keyPoints).toEqual([])
      expect(note.stumbledPoints).toEqual([])
    })
  })

  describe("NoteWithTopic type (from repository)", () => {
    it("should include topic and subject names", () => {
      const noteWithTopic: NoteWithTopic = {
        id: "note-123",
        userId: "user-123",
        topicId: "topic-123",
        sessionId: "session-123",
        aiSummary: "Summary of the session",
        userMemo: "My notes",
        keyPoints: ["Point 1"],
        stumbledPoints: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        topicName: "Depreciation Methods",
        subjectName: "Financial Accounting",
      }

      expect(noteWithTopic.topicName).toBe("Depreciation Methods")
      expect(noteWithTopic.subjectName).toBe("Financial Accounting")
    })
  })

  describe("NoteWithTopicDetail type (from repository)", () => {
    it("should include full topic hierarchy", () => {
      const noteWithDetail: NoteWithTopicDetail = {
        id: "note-123",
        userId: "user-123",
        topicId: "topic-123",
        sessionId: "session-123",
        aiSummary: "Summary",
        userMemo: "Notes",
        keyPoints: [],
        stumbledPoints: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        topicName: "Depreciation Methods",
        categoryId: "category-123",
        subjectId: "subject-123",
        subjectName: "Financial Accounting",
      }

      expect(noteWithDetail.categoryId).toBe("category-123")
      expect(noteWithDetail.subjectId).toBe("subject-123")
    })
  })

  describe("noteSchema (Zod)", () => {
    it("should parse valid note data", () => {
      const data = {
        id: "note-123",
        userId: "user-123",
        topicId: "topic-123",
        sessionId: "session-123",
        aiSummary: "AI generated summary",
        userMemo: "User memo",
        keyPoints: ["Key point 1", "Key point 2"],
        stumbledPoints: ["Stumbled point 1"],
        createdAt: "2024-01-15T10:00:00.000Z",
        updatedAt: "2024-01-15T10:00:00.000Z",
      }

      const result = noteSchema.safeParse(data)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.keyPoints).toHaveLength(2)
      }
    })

    it("should accept null for optional fields", () => {
      const data = {
        id: "note-123",
        userId: "user-123",
        topicId: "topic-123",
        sessionId: null,
        aiSummary: null,
        userMemo: null,
        keyPoints: [],
        stumbledPoints: [],
        createdAt: "2024-01-15T10:00:00.000Z",
        updatedAt: "2024-01-15T10:00:00.000Z",
      }

      const result = noteSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    it("should reject invalid datetime format", () => {
      const data = {
        id: "note-123",
        userId: "user-123",
        topicId: "topic-123",
        sessionId: null,
        aiSummary: null,
        userMemo: null,
        keyPoints: [],
        stumbledPoints: [],
        createdAt: "invalid-date",
        updatedAt: "2024-01-15T10:00:00.000Z",
      }

      const result = noteSchema.safeParse(data)
      expect(result.success).toBe(false)
    })

    it("should reject non-array keyPoints", () => {
      const data = {
        id: "note-123",
        userId: "user-123",
        topicId: "topic-123",
        sessionId: null,
        aiSummary: null,
        userMemo: null,
        keyPoints: "not an array",
        stumbledPoints: [],
        createdAt: "2024-01-15T10:00:00.000Z",
        updatedAt: "2024-01-15T10:00:00.000Z",
      }

      const result = noteSchema.safeParse(data)
      expect(result.success).toBe(false)
    })
  })

  describe("createNoteRequestSchema (Zod)", () => {
    it("should parse valid request", () => {
      const result = createNoteRequestSchema.safeParse({
        sessionId: "session-123",
      })
      expect(result.success).toBe(true)
    })

    it("should reject missing sessionId", () => {
      const result = createNoteRequestSchema.safeParse({})
      expect(result.success).toBe(false)
    })

    it("should reject non-string sessionId", () => {
      const result = createNoteRequestSchema.safeParse({
        sessionId: 123,
      })
      expect(result.success).toBe(false)
    })
  })

  describe("updateNoteRequestSchema (Zod)", () => {
    it("should parse valid update with all fields", () => {
      const result = updateNoteRequestSchema.safeParse({
        userMemo: "Updated memo",
        keyPoints: ["New key point"],
        stumbledPoints: ["New stumbled point"],
      })
      expect(result.success).toBe(true)
    })

    it("should parse partial update with only memo", () => {
      const result = updateNoteRequestSchema.safeParse({
        userMemo: "Updated memo only",
      })
      expect(result.success).toBe(true)
    })

    it("should parse empty object (no fields to update)", () => {
      const result = updateNoteRequestSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it("should reject memo exceeding max length", () => {
      const result = updateNoteRequestSchema.safeParse({
        userMemo: "a".repeat(50001),
      })
      expect(result.success).toBe(false)
    })

    it("should reject keyPoints exceeding max count", () => {
      const result = updateNoteRequestSchema.safeParse({
        keyPoints: Array(51).fill("point"),
      })
      expect(result.success).toBe(false)
    })

    it("should reject keyPoint exceeding max length", () => {
      const result = updateNoteRequestSchema.safeParse({
        keyPoints: ["a".repeat(1001)],
      })
      expect(result.success).toBe(false)
    })

    it("should reject stumbledPoints exceeding max count", () => {
      const result = updateNoteRequestSchema.safeParse({
        stumbledPoints: Array(51).fill("point"),
      })
      expect(result.success).toBe(false)
    })

    it("should reject stumbledPoint exceeding max length", () => {
      const result = updateNoteRequestSchema.safeParse({
        stumbledPoints: ["a".repeat(1001)],
      })
      expect(result.success).toBe(false)
    })
  })
})
