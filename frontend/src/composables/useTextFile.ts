import { ref, toValue, watch, type MaybeRefOrGetter } from 'vue'

export function useTextFile(name: MaybeRefOrGetter<string>) {
  const source = ref('')
  const loading = ref(true)
  const error = ref('')

  watch(() => toValue(name), async (entityName, _, onCleanup) => {
    const controller = new AbortController()
    onCleanup(() => controller.abort())
    source.value = ''
    error.value = ''
    loading.value = true
    try {
      const response = await fetch(
        `/api/method/suite.drive.api.files.get_file_content?entity_name=${encodeURIComponent(entityName)}`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json; charset=utf-8',
            'X-Frappe-Site-Name': window.location.hostname,
            Range: 'bytes=0-10000000',
          },
          signal: controller.signal,
        },
      )
      if (!response.ok) throw new Error(`Unable to load file (${response.status}).`)
      const blob = await response.blob()
      const text = await blob.text()
      if (!controller.signal.aborted) source.value = text
    } catch (cause) {
      if (!controller.signal.aborted) {
        error.value = cause instanceof Error ? cause.message : 'Unable to load file.'
      }
    } finally {
      if (!controller.signal.aborted) loading.value = false
    }
  }, { immediate: true })

  return { source, loading, error }
}
