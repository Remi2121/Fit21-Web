import React from "react";
import Fit from "./components/fithome/fithome.jsx";
import Owners from "./owners/owners.jsx";
import Testimonials from "./Testimonials/Testimonials.jsx";
import Fooder from "./components/fooder/Fooder.jsx";
import ContactUs from "./contactus/contactus..jsx";
import Quiz from "./quiz/quiz.jsx";

export default function Home() {
  return (
    <>
      <Fit />
      <Quiz/>
      <Owners />
      <Testimonials />
      <ContactUs />
      <Fooder />
    </>
  );
}
