import React from "react";
import Fit from "./components/fithome/fithome.jsx";
import Owners from "./owners/owners.jsx";
import Testimonials from "./Testimonials/Testimonials.jsx";
import Fooder from "./components/fooder/Fooder.jsx";
import ContactUs from "./contactus/contactus..jsx";
import Announcement from "./announcements/announcements.jsx"

export default function Home() {
  return (
    <>
      <Fit />
      <Owners />
      <Testimonials />
      <Announcement/>
      <ContactUs />
      <Fooder />
    </>
  );
}
