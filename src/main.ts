import './styles/tokens.css'
import './styles/main.css'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { useSettingsStore } from './stores/settings'
import { t } from './i18n'

const app = createApp(App)
app.use(createPinia())
app.config.globalProperties.$t = t

// 设置（主题 / 色板 / 表格样式）需要在挂载前落地，避免首帧闪白
useSettingsStore().init()

app.mount('#app')
