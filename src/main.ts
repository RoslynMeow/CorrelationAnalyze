import './styles/tokens.css'
import './styles/main.css'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { useThemeStore } from './stores/theme'

const app = createApp(App)
app.use(createPinia())

// 主题需要在挂载前落地，避免首帧闪白
useThemeStore().init()

app.mount('#app')
