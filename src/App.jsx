import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Layout from './components/Layout'
import Entrar from './pages/Entrar'
import Inicio from './pages/Inicio'
import Socios from './pages/Socios'
import Cuenta from './pages/Cuenta'
import Clientes from './pages/Clientes'
import ClienteForm from './pages/ClienteForm'
import ClienteDetalle from './pages/ClienteDetalle'
import Mas from './pages/Mas'
import Ganancias from './pages/Ganancias'
import Negocio from './pages/Negocio'
import Precios from './pages/Precios'
import ViajeActual from './pages/ViajeActual'
import Viajes from './pages/Viajes'
import ViajeForm from './pages/ViajeForm'
import ViajeDetalle from './pages/ViajeDetalle'
import FacturaForm from './pages/FacturaForm'
import FacturaDetalle from './pages/FacturaDetalle'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/entrar" element={<Entrar />} />
          <Route element={<Layout />}>
            <Route path="/" element={<Inicio />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/clientes/nuevo" element={<ClienteForm />} />
            <Route path="/clientes/:id" element={<ClienteDetalle />} />
            <Route path="/clientes/:id/editar" element={<ClienteForm />} />
            <Route path="/viaje" element={<ViajeActual />} />
            <Route path="/viajes" element={<Viajes />} />
            <Route path="/viajes/nuevo" element={<ViajeForm />} />
            <Route path="/viajes/:id" element={<ViajeDetalle />} />
            <Route path="/viajes/:id/editar" element={<ViajeForm />} />
            <Route path="/facturas/nueva" element={<FacturaForm />} />
            <Route path="/facturas/:id" element={<FacturaDetalle />} />
            <Route path="/facturas/:id/editar" element={<FacturaForm />} />
            <Route path="/mas" element={<Mas />} />
            <Route path="/ganancias" element={<Ganancias />} />
            <Route path="/negocio" element={<Negocio />} />
            <Route path="/precios" element={<Precios />} />
            <Route path="/socios" element={<Socios />} />
            <Route path="/cuenta" element={<Cuenta />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
