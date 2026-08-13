/** 深拷贝（JSON 可序列化对象；含函数/循环引用勿用） */
export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
