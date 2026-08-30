<script setup lang="ts">
const route = useRoute()
const projectId = route.query.project as string | undefined

if (projectId) {
  await navigateTo(`/projects/${projectId}`, { replace: true })
} else {
  await navigateTo('/projects', { replace: true })
}
</script>
