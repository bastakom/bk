import Link from "next/link";
import Header from "./[lang]/components/Header";
import Footer from "./[lang]/components/Footer";

const Custom404 = () => {
  return (
    <main>
      <Header />
      <div className="h-[60vh] flex flex-col justify-center items-center">
        <h1 className="text-[45px]">404 - Sidan finns inte</h1>
        <Link href="/">Gå till startsidan</Link>
      </div>
      <Footer />
    </main>
  );
};

export default Custom404;
