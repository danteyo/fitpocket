import { BodyArea, Intensity, WorkoutRecord } from '../domain/workout'
import { WorkoutRepository } from './workout-repository'

interface CloudWorkoutDocument {
  _id: string
  date: string
  bodyArea?: BodyArea
  intensity?: Intensity
  createdAt: string
  updatedAt: string
}

function toRecord(document: CloudWorkoutDocument): WorkoutRecord {
  const record: WorkoutRecord = {
    date: document.date,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  }
  if (document.bodyArea) record.bodyArea = document.bodyArea
  if (document.intensity) record.intensity = document.intensity
  return record
}

export class CloudWorkoutRepository implements WorkoutRepository {
  private readonly collection = wx.cloud.database().collection('workouts')

  async get(date: string): Promise<WorkoutRecord | null> {
    const result = await this.collection.where({ date }).limit(1).get()
    const document = result.data[0] as CloudWorkoutDocument | undefined
    return document ? toRecord(document) : null
  }

  async upsert(record: WorkoutRecord): Promise<void> {
    const result = await this.collection.where({ date: record.date }).limit(1).get()
    const document = result.data[0] as CloudWorkoutDocument | undefined
    if (document && document.updatedAt > record.updatedAt) return
    const data: Record<string, unknown> = {
      date: record.date,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      bodyArea: record.bodyArea || null,
      intensity: record.intensity || null,
    }
    if (document) await this.collection.doc(document._id).update({ data })
    else await this.collection.add({ data })
  }

  async remove(date: string): Promise<void> {
    const result = await this.collection.where({ date }).limit(1).get()
    const document = result.data[0] as CloudWorkoutDocument | undefined
    if (document) await this.collection.doc(document._id).remove()
  }

  async list(start: string, end: string): Promise<WorkoutRecord[]> {
    const command = wx.cloud.database().command
    const records: WorkoutRecord[] = []
    let offset = 0
    while (true) {
      const result = await this.collection.where({ date: command.gte(start).and(command.lte(end)) })
        .orderBy('date', 'asc').skip(offset).limit(100).get()
      const batch = (result.data as unknown as CloudWorkoutDocument[]).map(toRecord)
      records.push(...batch)
      if (batch.length < 100) return records
      offset += batch.length
    }
  }
}
