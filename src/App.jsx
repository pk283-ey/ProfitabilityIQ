import { useState } from 'react'
import UploadScreen from './components/UploadScreen.jsx'
import Dashboard    from './components/Dashboard/index.jsx'
import ChatScreen   from './components/ChatScreen.jsx'

export default function App() {
  const [screen, setScreen]       = useState('upload')   // 'upload' | 'dashboard' | 'chat'
  const [parsedData, setParsedData] = useState(null)

  function handleDataReady(data) {
    setParsedData(data)
    setScreen('dashboard')
  }

  return (
    <>
      {screen === 'upload' && (
        <UploadScreen onReady={handleDataReady} />
      )}
      {screen === 'dashboard' && parsedData && (
        <Dashboard
          parsedData={parsedData}
          onNavigateToChat={() => setScreen('chat')}
          onBack={() => setScreen('upload')}
        />
      )}
      {screen === 'chat' && parsedData && (
        <ChatScreen
          parsedData={parsedData}
          onBack={() => setScreen('dashboard')}
        />
      )}
    </>
  )
}
