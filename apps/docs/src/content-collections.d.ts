declare module 'content-collections' {
  export interface Doc {
    title: string
    description: string
    order: number
    slug: string
    url: string
    rawContent: string
    markup: string
    headings: {
      level: number
      text: string
      id: string
    }[]
  }

  export const allDocs: Doc[]
}
