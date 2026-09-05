import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Layout } from "./components/Layout";
import Login from "./pages/Login";
import Home from "./pages/Home";

const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <Layout />,
        children: [{ index: true, element: <Home /> }],
      },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
