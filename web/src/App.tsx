import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Layout } from "./components/Layout";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Templates from "./pages/Templates";
import Trips from "./pages/Trips";
import Schedule from "./pages/Schedule";
import Listings from "./pages/Listings";
import ListingContent from "./pages/ListingContent";

const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <Layout />,
        children: [
          { index: true, element: <Home /> },
          { path: "templates", element: <Templates /> },
          { path: "trips", element: <Trips /> },
          { path: "trips/:tripId", element: <Schedule /> },
          { path: "listings", element: <Listings /> },
          { path: "listings/:listingId", element: <ListingContent /> },
        ],
      },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
