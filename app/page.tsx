/* eslint-disable @next/next/no-img-element */
"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { msSupabase } from "@/lib/supabaseClient";
import { localData, type BookContent } from "@/lib/bookData";
import {
  ApproveIcon,
  AvatarCardMIcon,
  AvatarToolIcon,
  CopyIcon,
  DownloadIcon,
  DropdownChevronIcon,
  EditNotesIcon,
  GenderFemaleIcon,
  GenderMaleIcon,
  ImageReviewIcon,
  LogoIcon,
  ResetIcon,
  SaveIcon,
  SettingsGearIcon,
  ShadeIcon,
  SolveIcon,
  StarIcon,
  UploadIcon,
  ZoomIcon,
} from "./icons";

const BOOK_ID = "1e461b89-f9f3-45a4-b36f-479ed823336d";
const STORAGE_BASE =
  "https://cqnqfvusotfvynhabueh.supabase.co/storage/v1/object/public";

interface BookMeta {
  order_id: string | number;
  book_title: string;
  max_pages: number;
  kid_name: string;
  kid_age: number | string;
  kid_gender: string;
  kid_img_half: string | null;
  kid_img_full: string | null;
  companion_name: string | null;
  companion_img_half: string | null;
  companion_img_full: string | null;
}

interface Popup {
  open: boolean;
  x: number;
  y: number;
}

interface Actions {
  onPointerMove: (e: PointerEvent) => void;
  handleKey: (e: KeyboardEvent) => void;
  handleContextMenu: (e: MouseEvent) => void;
  handleOutside: (e: MouseEvent) => void;
}

const ZOOM_FACTOR = 2;

export default function Home() {
  // ---- data ----
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [meta, setMeta] = useState<BookMeta | null>(null);
  const [book, setBook] = useState<BookContent | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [favs, setFavs] = useState<number[]>([]);
  const [notes, setNotes] = useState<string[]>([]);

  // ---- view state ----
  const [currPage, setCurrPage] = useState(0);
  const [buildUpTo, setBuildUpTo] = useState(0); // page indices 0..buildUpTo are mounted
  const [revealedPages, setRevealedPages] = useState<number[]>([]); // images loaded -> show text

  // ---- settings ----
  const [fillerPages, setFillerPages] = useState(true);
  const [textPages, setTextPages] = useState(true);
  const [hotkeysOn, setHotkeysOn] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // ---- tools ----
  const [zoomOn, setZoomOn] = useState(false);
  const [avatarOn, setAvatarOn] = useState(false);

  // ---- popups ----
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<Popup>({ open: false, x: 0, y: 0 });
  const [notesPanel, setNotesPanel] = useState<Popup>({ open: false, x: 0, y: 0 });
  const [notesDraft, setNotesDraft] = useState("");
  const [alert, setAlert] = useState<{ open: boolean; message: string }>({
    open: false,
    message: "",
  });

  // ---- refs ----
  const mainRef = useRef<HTMLElement | null>(null);
  const focusBoxRef = useRef<HTMLDivElement | null>(null);
  const divZoomRef = useRef<HTMLDivElement | null>(null);
  const divAvatarRef = useRef<HTMLDivElement | null>(null);
  const contAvatarRef = useRef<HTMLDivElement | null>(null);
  const ctxMenuRef = useRef<HTMLDivElement | null>(null);
  const notesRef = useRef<HTMLDivElement | null>(null);
  const actionsRef = useRef<Partial<Actions>>({});
  const revealedRef = useRef<Set<number>>(new Set());

  // zoom internals
  const zoomSourceRef = useRef<HTMLImageElement | null>(null);
  const zoomCloneRef = useRef<HTMLImageElement | null>(null);
  const lensRadiusRef = useRef(75);
  const cursorRef = useRef({ x: 0, y: 0 });
  const zoomFrameRef = useRef(0);

  const maxPages = meta?.max_pages ?? 0;
  const titleSlug = meta ? meta.book_title.replaceAll(" ", "_").toLowerCase() : "";
  const textPos = book ? book.text_position.split(", ") : [];
  const pageTypes = book ? book.page_type.split(", ") : [];

  // ===================================================================
  // Data loading (book main -> avatars -> pages -> favorites -> notes)
  // ===================================================================
  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      try {
        const { data: mainData, error: mainErr } = await msSupabase
          .from("table_book_main")
          .select("*")
          .eq("book_id", BOOK_ID);
        if (mainErr) throw mainErr;
        if (!mainData || mainData.length === 0)
          throw new Error("No book found for this id.");

        const order_id = mainData[0].order_id;
        const book_title = mainData[0].book_title;
        const max_pages = mainData[0].max_pages;

        const { data: avData } = await msSupabase
          .from("table_avatars")
          .select("*")
          .eq("book_id", BOOK_ID);
        const av = avData?.[0] ?? {};

        const { data: pageData } = await msSupabase
          .from("table_pages")
          .select("image_url")
          .eq("book_id", BOOK_ID)
          .eq("page", 0);

        const pagesArr: string[] = [];
        pagesArr[0] = pageData?.[0]?.image_url ?? "";
        for (let a = 1; a <= max_pages; a++) {
          pagesArr[a] = `${STORAGE_BASE}/sample_images/${BOOK_ID}/${a}.png`;
        }

        const { data: favData } = await msSupabase
          .from("table_favorites")
          .select("design_review_fav")
          .eq("book_id", BOOK_ID);
        const favsArr: number[] = favData?.[0]?.design_review_fav
          ? JSON.parse(favData[0].design_review_fav)
          : [];

        const { data: notesData } = await msSupabase
          .from("table_notes")
          .select("page, design_review_notes")
          .eq("book_id", BOOK_ID);
        const notesArr: string[] = [];
        notesData?.forEach(
          (row: { page: number; design_review_notes: string | null }) => {
            notesArr[row.page] = row.design_review_notes || "";
          }
        );

        const bookContent = localData(book_title, av.kid_name);
        if (!bookContent)
          throw new Error(`No local content for book "${book_title}".`);

        if (cancelled) return;

        setMeta({
          order_id,
          book_title,
          max_pages,
          kid_name: av.kid_name,
          kid_age: av.kid_age,
          kid_gender: av.kid_gender,
          kid_img_half: av.kid_img_half ?? null,
          kid_img_full: av.kid_img_full ?? null,
          companion_name: av.companion_name ?? null,
          companion_img_half: av.companion_img_half ?? null,
          companion_img_full: av.companion_img_full ?? null,
        });
        setBook(bookContent);
        setPages(pagesArr);
        setFavs(favsArr);
        setNotes(notesArr);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to load book data.";
        setLoadError(message);
        setLoading(false);
      }
    }

    loadAll();
    return () => {
      cancelled = true;
    };
  }, []);

  // keep the document title in sync with the order id
  useEffect(() => {
    if (meta) document.title = `${meta.order_id} - Design Review`;
  }, [meta]);

  // ===================================================================
  // Progressive page loader (mirrors the original checkPageIfComplete chain):
  // reveal each page's text once its images have loaded, then mount the next.
  //
  // Reveal is declarative: a page index is pushed into `revealedPages`, which
  // stamps `data-revealed="true"` on its container so CSS shows the text. We
  // must NOT mutate `.textWrapper.style` directly — that lives inside a
  // dangerouslySetInnerHTML subtree, so the next setBuildUpTo() re-render wipes
  // the change (only the final page would survive).
  // ===================================================================
  useEffect(() => {
    if (loading || !book || !meta) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const check = () => {
      if (cancelled) return;
      const main = mainRef.current;
      if (!main) {
        timer = setTimeout(check, 200);
        return;
      }

      // reveal any mounted page (0..buildUpTo) whose images have finished
      const newlyRevealed: number[] = [];
      for (let i = 0; i <= buildUpTo && i <= meta.max_pages; i++) {
        if (revealedRef.current.has(i)) continue;
        const el = main.children[i];
        if (!el) continue;
        const imgs = Array.from(el.querySelectorAll("img"));
        const done = imgs.length > 0 && imgs.every((im) => im.complete);
        if (done) {
          revealedRef.current.add(i);
          newlyRevealed.push(i);
        }
      }
      if (newlyRevealed.length) {
        setRevealedPages((prev) => [...prev, ...newlyRevealed]);
      }

      if (revealedRef.current.has(buildUpTo)) {
        if (buildUpTo < meta.max_pages) {
          setBuildUpTo((p) => Math.max(p, buildUpTo + 1));
        }
      } else {
        timer = setTimeout(check, 300);
      }
    };

    check();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [buildUpTo, loading, book, meta]);

  // ===================================================================
  // Zoom lens (magnifier) — ported from the original
  // ===================================================================
  function setZoomSource(img: HTMLImageElement) {
    const divZoom = divZoomRef.current;
    if (!divZoom) return;
    const box = img.getBoundingClientRect();

    if (!zoomCloneRef.current || zoomCloneRef.current.src !== img.src) {
      divZoom.replaceChildren();
      const clone = img.cloneNode(true) as HTMLImageElement;
      zoomCloneRef.current = clone;
      divZoom.appendChild(clone);
    }

    const clone = zoomCloneRef.current;
    clone.style.width = box.width * ZOOM_FACTOR + "px";
    clone.style.height = box.height * ZOOM_FACTOR + "px";
    lensRadiusRef.current = divZoom.offsetWidth / 2;
    zoomSourceRef.current = img;
  }

  function renderZoom() {
    const src = zoomSourceRef.current;
    const clone = zoomCloneRef.current;
    const divZoom = divZoomRef.current;
    if (!src || !clone || !divZoom) return;

    const box = src.getBoundingClientRect();
    const { x, y } = cursorRef.current;
    const spotX = x - box.left;
    const spotY = y - box.top;
    const r = lensRadiusRef.current;

    divZoom.style.transform = `translate(${x - r}px, ${y - r}px)`;
    clone.style.transform = `translate(${r - spotX * ZOOM_FACTOR}px, ${
      r - spotY * ZOOM_FACTOR
    }px)`;
  }

  function hideZoomLens() {
    if (zoomFrameRef.current) {
      cancelAnimationFrame(zoomFrameRef.current);
      zoomFrameRef.current = 0;
    }
    if (divZoomRef.current) divZoomRef.current.style.display = "none";
    zoomSourceRef.current = null;
  }

  function updateZoom() {
    if (!zoomOn) {
      hideZoomLens();
      return;
    }
    const { x, y } = cursorRef.current;
    const underCursor = document.elementFromPoint(x, y);
    // image holders can stack a gradient/text layer over the image, so always
    // grab the first <img> inside the holder rather than the top element
    const holder = underCursor?.closest("#coverFront, .pageL, .pageR");
    const target = holder
      ? (holder.querySelector("img") as HTMLImageElement | null)
      : (underCursor as Element | null);

    if (target && target.tagName === "IMG") {
      const img = target as HTMLImageElement;
      if (img !== zoomSourceRef.current) {
        if (divZoomRef.current) divZoomRef.current.style.display = "block";
        setZoomSource(img);
      }
      renderZoom();
    } else {
      hideZoomLens();
    }
  }

  function queueZoom() {
    if (zoomFrameRef.current) return;
    zoomFrameRef.current = requestAnimationFrame(() => {
      zoomFrameRef.current = 0;
      updateZoom();
    });
  }

  // hide the lens whenever zoom mode is turned off
  useEffect(() => {
    if (!zoomOn) hideZoomLens();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomOn]);

  // ===================================================================
  // Avatar overlay open/close transition (mirrors toggleAvatar)
  // ===================================================================
  useEffect(() => {
    const da = divAvatarRef.current;
    const ca = contAvatarRef.current;
    if (!da || !ca) return;

    if (avatarOn) {
      da.classList.add("open");
      if (zoomOn) queueZoom();
      const t = setTimeout(() => {
        da.style.opacity = "1";
        ca.style.opacity = "1";
        ca.style.scale = "100%";
      }, 100);
      return () => clearTimeout(t);
    }

    da.style.opacity = "0";
    ca.style.opacity = "0";
    ca.style.scale = "95%";
    const t = setTimeout(() => {
      da.classList.remove("open");
      if (zoomOn) queueZoom();
    }, 100);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatarOn]);

  // ===================================================================
  // Popup helpers
  // ===================================================================
  function hideDropdown() {
    setDropdownOpen(false);
  }
  function hideContextMenu() {
    setCtxMenu((c) => ({ ...c, open: false }));
  }
  function hideNotes() {
    setNotesPanel((n) => ({ ...n, open: false }));
  }
  function closePopups() {
    hideDropdown();
    hideContextMenu();
    hideNotes();
  }

  function showContextMenu(x: number, y: number) {
    hideDropdown();
    hideNotes();
    setCtxMenu({ open: true, x, y });
  }

  function addNotes() {
    hideDropdown();
    hideContextMenu();
    setNotesDraft(notes[currPage] || "");
    setNotesPanel({ open: true, x: ctxMenu.x, y: ctxMenu.y });
  }

  // clamp popups inside the viewport once they have been measured
  useLayoutEffect(() => {
    if (!ctxMenu.open) return;
    const el = ctxMenuRef.current;
    if (!el) return;
    const x = Math.min(ctxMenu.x, window.innerWidth - el.offsetWidth - 4);
    const y = Math.min(ctxMenu.y, window.innerHeight - el.offsetHeight - 4);
    el.style.left = x + "px";
    el.style.top = y + "px";
  }, [ctxMenu]);

  useLayoutEffect(() => {
    if (!notesPanel.open) return;
    const el = notesRef.current;
    if (!el) return;
    const x = Math.min(notesPanel.x, window.innerWidth - el.offsetWidth - 4);
    const y = Math.min(notesPanel.y, window.innerHeight - el.offsetHeight - 4);
    el.style.left = x + "px";
    el.style.top = y + "px";
  }, [notesPanel]);

  // ===================================================================
  // Page focus + navigation
  // ===================================================================
  function focusPage() {
    const main = mainRef.current;
    const fb = focusBoxRef.current;
    if (!main || !fb || !meta) return;
    const fbRect = fb.getBoundingClientRect();

    for (let a = 0; a <= meta.max_pages; a++) {
      const el = main.children[a];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const top = r.top;
      const bottom = r.bottom;
      const mid = r.top + r.height / 2;

      const boolTop = top > fbRect.top && top < fbRect.bottom;
      const boolBottom = bottom > fbRect.top && bottom < fbRect.bottom;
      const boolMiddle = mid > fbRect.top && mid < fbRect.bottom;

      if ((boolTop && boolMiddle) || (boolBottom && boolMiddle) || boolMiddle) {
        setCurrPage(a);
      }
    }
  }

  function goToPage(i: number) {
    setBuildUpTo((p) => Math.max(p, i));
    const main = mainRef.current;
    const el = main?.children[i] as HTMLElement | undefined;
    if (!main || !el) return;
    main.scrollTo({ top: el.offsetTop - 128, behavior: "instant" });
    focusPage();
  }

  function handleScroll() {
    focusPage();
    closePopups();
    if (zoomOn) queueZoom();
  }

  // ===================================================================
  // Tool actions
  // ===================================================================
  function copyOrderID() {
    if (meta) navigator.clipboard?.writeText(String(meta.order_id));
  }

  function toggleZoom() {
    setZoomOn((z) => !z);
  }

  function toggleAvatar() {
    setAvatarOn((a) => !a);
  }

  function currentRegularPage(): HTMLElement | null {
    return (
      (mainRef.current?.querySelector(
        `.divRegularPage[data-page="${currPage}"]`
      ) as HTMLElement | null) ?? null
    );
  }

  function toggleShade() {
    const page = currentRegularPage();
    if (!page) return; // the cover has no text gradient

    const textHalf =
      page.dataset.textposition === "L"
        ? page.querySelector(".pageL")
        : page.querySelector(".pageR");
    const grad = textHalf?.querySelector(".textGradient") as HTMLElement | null;
    if (!grad) return;

    if (page.dataset.shade === "true") {
      page.dataset.shade = "false";
      grad.style.visibility = "hidden";
    } else {
      page.dataset.shade = "true";
      grad.style.visibility = "visible";
    }
  }

  function coverImage(): HTMLImageElement | null {
    return (
      (mainRef.current?.querySelector(
        "#coverFront img"
      ) as HTMLImageElement | null) ?? null
    );
  }

  function regularPhotoImage(): HTMLImageElement | null {
    const page = currentRegularPage();
    if (!page) return null;
    const half =
      page.dataset.textposition === "L"
        ? page.querySelector(".pageR")
        : page.querySelector(".pageL");
    return (half?.querySelector("img") as HTMLImageElement | null) ?? null;
  }

  async function downloadImage() {
    const imageSource = currPage === 0 ? coverImage() : regularPhotoImage();
    if (!imageSource) return;

    const fileName = `${BOOK_ID}_${currPage}.png`;
    try {
      const response = await fetch(imageSource.src);
      const blob = await response.blob();
      const objectURL = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectURL;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(objectURL);
    } catch {
      showAlert("⚠ Download Failed: Please try again later");
    }
  }

  function uploadImage() {
    let targetImage: HTMLImageElement | null;
    let minRatio: number;
    let maxRatio: number;
    let minWidth: number;
    let minHeight: number;

    if (currPage === 0) {
      targetImage = coverImage();
      minRatio = 1.19;
      maxRatio = 1.21;
      minWidth = 3700;
      minHeight = 3000;
    } else {
      targetImage = regularPhotoImage();
      minRatio = 1.36;
      maxRatio = 1.38;
      minWidth = 3400;
      minHeight = 2500;
    }

    if (!targetImage) return;
    const target = targetImage;

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/png";

    fileInput.onchange = () => {
      const file = fileInput.files?.[0];
      if (!file) return;

      if (file.type !== "image/png") {
        showAlert(
          "⚠ Upload Failed: Please check the image aspect ratio and resolution"
        );
        return;
      }

      const objectURL = URL.createObjectURL(file);
      const probe = new Image();

      probe.onload = () => {
        const aspectRatio = probe.width / probe.height;

        if (aspectRatio < minRatio || aspectRatio > maxRatio) {
          URL.revokeObjectURL(objectURL);
          showAlert(
            "⚠ Upload Failed: Please check the image aspect ratio and resolution"
          );
          return;
        }
        if (probe.width < minWidth || probe.height < minHeight) {
          URL.revokeObjectURL(objectURL);
          showAlert(
            "⚠ Upload Failed: Please check the image aspect ratio and resolution"
          );
          return;
        }
        target.src = objectURL;
      };

      probe.src = objectURL;
    };

    fileInput.click();
  }

  function resetImage() {
    const img = regularPhotoImage();
    if (img) img.src = pages[currPage];
  }

  function viewInImageReview() {
    if (!book) return;
    const ref =
      currPage === 0
        ? book.references["coverFront"]
        : book.references[`page${currPage}`];
    if (ref) window.open(ref, "_blank", "noopener,noreferrer");
  }

  function approve() {
    // The original wires no behaviour to APPROVE / Ctrl+Enter — kept as a no-op.
  }

  async function updateFavorites() {
    const cp = currPage;
    const next = favs.includes(cp)
      ? favs.filter((item) => item !== cp)
      : [...favs, cp];
    setFavs(next);

    const { error } = await msSupabase
      .from("table_favorites")
      .update({ design_review_fav: JSON.stringify(next) })
      .eq("book_id", BOOK_ID);

    if (error) showAlert("⚠ Saving Failed: Please try again later");
  }

  function showAlert(message: string) {
    setAlert({ open: true, message });
  }

  async function solveNote() {
    const cp = currPage;
    setNotes((prev) => {
      const n = [...prev];
      n[cp] = "";
      return n;
    });
    hideNotes();

    const { error } = await msSupabase
      .from("table_notes")
      .update({ design_review_notes: "" })
      .eq("book_id", BOOK_ID)
      .eq("page", cp);

    if (error) showAlert("⚠ Saving Failed: Please try again later");
  }

  async function saveNote() {
    const cp = currPage;
    const value = notesDraft;
    setNotes((prev) => {
      const n = [...prev];
      n[cp] = value;
      return n;
    });
    hideNotes();

    const { data } = await msSupabase
      .from("table_notes")
      .select("page")
      .eq("book_id", BOOK_ID)
      .eq("page", cp);

    let error;
    if (data && data.length > 0) {
      const res = await msSupabase
        .from("table_notes")
        .update({ design_review_notes: value })
        .eq("book_id", BOOK_ID)
        .eq("page", cp);
      error = res.error;
    } else {
      const res = await msSupabase
        .from("table_notes")
        .insert({ book_id: BOOK_ID, page: cp, design_review_notes: value });
      error = res.error;
    }

    if (error) showAlert("⚠ Saving Failed: Please try again later");
  }

  // ===================================================================
  // Document-level event handlers (refreshed each render, dispatched once)
  // ===================================================================
  function onPointerMove(e: PointerEvent) {
    cursorRef.current = { x: e.clientX, y: e.clientY };
    if (zoomOn) queueZoom();
  }

  function handleKey(e: KeyboardEvent) {
    const t = e.target as HTMLElement | null;
    if (t && typeof t.matches === "function" && t.matches("input, textarea"))
      return;

    if (e.ctrlKey && e.key === "Enter") {
      approve();
      return;
    }
    if (e.key === "Escape") {
      hideNotes();
      hideContextMenu();
      hideDropdown();
      if (avatarOn) toggleAvatar();
      return;
    }

    let key = e.key.toUpperCase();
    if (key === "`") key = "~";

    if (key === "C") copyOrderID();
    else if (key === "~") toggleZoom();
    else if (key === "A") toggleAvatar();
    else if (key === "S") toggleShade();
    else if (key === "D") downloadImage();
    else if (key === "F") uploadImage();
    else if (key === "R") resetImage();
  }

  function handleContextMenu(e: MouseEvent) {
    const main = mainRef.current;
    if (!main) return;
    const t = e.target as HTMLElement | null;
    const pageEl = t?.closest("main > *") ?? null;

    if (pageEl && pageEl === main.children[currPage]) {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY);
    } else {
      closePopups();
    }
  }

  function handleOutside(e: MouseEvent) {
    const t = e.target as HTMLElement | null;
    if (!t) return;
    if (!t.closest("#contextMenu")) hideContextMenu();
    if (!t.closest("#divNotes")) hideNotes();
    if (!t.closest("#dropPages")) hideDropdown();
  }

  // keep the latest closures available to the once-registered listeners
  useEffect(() => {
    actionsRef.current = {
      onPointerMove,
      handleKey,
      handleContextMenu,
      handleOutside,
    };
  });

  useEffect(() => {
    const move = (e: PointerEvent) => actionsRef.current.onPointerMove?.(e);
    const key = (e: KeyboardEvent) => actionsRef.current.handleKey?.(e);
    const ctx = (e: MouseEvent) => actionsRef.current.handleContextMenu?.(e);
    const down = (e: MouseEvent) => actionsRef.current.handleOutside?.(e);

    document.addEventListener("pointermove", move);
    document.addEventListener("keydown", key);
    document.addEventListener("contextmenu", ctx);
    document.addEventListener("mousedown", down);
    return () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("keydown", key);
      document.removeEventListener("contextmenu", ctx);
      document.removeEventListener("mousedown", down);
    };
  }, []);

  // ===================================================================
  // Render helpers
  // ===================================================================
  const isFav = (a: number) => favs.includes(a);
  const isFiller = (a: number) => !fillerPages && pageTypes[a - 1] !== "A";

  const referenceSrc =
    book && meta
      ? currPage === 0
        ? book.references["coverFront"]
        : book.references[`page${currPage}`]
      : undefined;

  function renderRegularInner(a: number, tp: string) {
    const photoSrc = pages[a];
    const templateSrc = `${STORAGE_BASE}/books/${titleSlug}/${a}.png`;
    const textHtml = book?.pages[`page${a}`] ?? "";
    const collapsed = !textPages;

    const textHalfStyle: CSSProperties = {
      position: "relative",
      display: collapsed ? "none" : undefined,
    };

    const textHalf = (
      <div className={tp === "L" ? "pageL" : "pageR"} style={textHalfStyle}>
        <img
          src={templateSrc}
          fetchPriority="high"
          style={{ position: "relative" }}
          alt=""
        />
        <div
          className="textGradient"
          style={{
            background:
              tp === "L"
                ? "linear-gradient(to right, rgba(0,0,0,1), transparent)"
                : "linear-gradient(to left, rgba(0,0,0,1), transparent)",
          }}
        />
        <div dangerouslySetInnerHTML={{ __html: textHtml }} />
      </div>
    );

    const photoHalf = (
      <div className={tp === "L" ? "pageR" : "pageL"}>
        <img src={photoSrc} alt="" />
      </div>
    );

    // text on the left -> [text][photo]; text on the right -> [photo][text]
    return tp === "L" ? (
      <>
        {textHalf}
        {photoHalf}
      </>
    ) : (
      <>
        {photoHalf}
        {textHalf}
      </>
    );
  }

  const hotkeyClass = `hotkey${hotkeysOn ? " show" : ""}`;
  const ready = !loading && !!book && !!meta;

  return (
    <>
      <header>
        <nav>
          <div id="logo">
            <LogoIcon />
          </div>
          <h1 className="h1sharp" style={{ marginRight: "1em" }}>
            DESIGN REVIEW
          </h1>
          <div className="vBar" />
          <h1 className="h1sharp" id="bookTitle" style={{ marginLeft: "1em" }}>
            {meta ? meta.book_title.toUpperCase() : ""}
          </h1>
          <h1 className="h1sharp" id="orderID" style={{ marginLeft: "auto" }}>
            {meta ? `ORDER ID: ${meta.order_id}` : ""}
          </h1>
          <div id="btnCopy" onClick={copyOrderID}>
            <CopyIcon />
            <div className={hotkeyClass} style={{ top: "150%", left: "-45%" }}>
              <h1 className="h1sharp">C</h1>
            </div>
          </div>
        </nav>
        {alert.open && (
          <div id="alertBanner" style={{ display: "flex" }}>
            <h1 className="h1sharpError">{alert.message}</h1>
            <div
              id="btnDismiss"
              onClick={() => setAlert((a) => ({ ...a, open: false }))}
            >
              <h1 className="h1sharpError">Dismiss</h1>
            </div>
          </div>
        )}
      </header>

      <div id="divZoom" ref={divZoomRef} />

      {ctxMenu.open && (
        <div
          id="contextMenu"
          ref={ctxMenuRef}
          style={{ left: `${ctxMenu.x}px`, top: `${ctxMenu.y}px` }}
        >
          <div
            className="optContext"
            id="ctxAddNotes"
            onClick={() => {
              hideContextMenu();
              addNotes();
            }}
          >
            <div className="iconContext">
              <EditNotesIcon />
            </div>
            <h1 className="h1muted">EDIT NOTES</h1>
          </div>
          <div
            className="optContext"
            id="ctxDownload"
            onClick={() => {
              hideContextMenu();
              downloadImage();
            }}
          >
            <div className="iconContext">
              <DownloadIcon />
            </div>
            <h1 className="h1muted">DOWNLOAD IMAGE</h1>
          </div>
          <div
            className="optContext"
            id="ctxUpload"
            onClick={() => {
              hideContextMenu();
              uploadImage();
            }}
          >
            <div className="iconContext">
              <UploadIcon />
            </div>
            <h1 className="h1muted">UPLOAD IMAGE</h1>
          </div>
          <div className="hBar" />
          <div
            className="optContext"
            id="ctxImageReview"
            onClick={() => {
              hideContextMenu();
              viewInImageReview();
            }}
          >
            <div className="iconContext">
              <ImageReviewIcon />
            </div>
            <h1 className="h1muted">VIEW IN IMAGE REVIEW</h1>
          </div>
        </div>
      )}

      {notesPanel.open && (
        <div
          id="divNotes"
          ref={notesRef}
          style={{ left: `${notesPanel.x}px`, top: `${notesPanel.y}px` }}
        >
          <textarea
            id="txtNotes"
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            placeholder="Write something..."
            spellCheck={false}
            autoComplete="off"
          />
          <div className="hBar" />
          <div id="notesActions">
            <div className="btnNotes" id="btnSolve" onClick={solveNote}>
              <div className="iconNote">
                <SolveIcon />
              </div>
              <h1 className="h1muted">SOLVE</h1>
            </div>
            <div className="btnNotes" id="btnSave" onClick={saveNote}>
              <div className="iconNote">
                <SaveIcon />
              </div>
              <h1 className="h1muted">SAVE</h1>
            </div>
          </div>
        </div>
      )}

      <div id="focusBox" ref={focusBoxRef} />

      <main ref={mainRef} onScroll={handleScroll}>
        {ready && (
          <>
            <div
              id="divCoverPage"
              data-page="0"
              data-revealed={revealedPages.includes(0) ? "true" : undefined}
            >
              <div
                id="coverBack"
                dangerouslySetInnerHTML={{ __html: book!.pages.coverBack }}
              />
              <div
                id="coverFront"
                dangerouslySetInnerHTML={{ __html: book!.pages.coverFront }}
              />
            </div>

            {Array.from({ length: maxPages }, (_, idx) => {
              const a = idx + 1;
              const tp = textPos[a - 1];
              const ptype = pageTypes[a - 1];
              const hidden = isFiller(a);
              const built = a <= buildUpTo;
              const collapsed = !textPages;
              return (
                <div
                  key={a}
                  className="divRegularPage"
                  data-page={a}
                  data-textposition={tp}
                  data-pagetype={ptype}
                  data-shade="true"
                  data-revealed={revealedPages.includes(a) ? "true" : undefined}
                  style={{
                    display: hidden ? "none" : undefined,
                    width: collapsed ? "700px" : undefined,
                  }}
                >
                  {built && renderRegularInner(a, tp)}
                </div>
              );
            })}
          </>
        )}
      </main>

      <div id="divAvatar" ref={divAvatarRef}>
        <div id="contAvatar" ref={contAvatarRef}>
          <div className="divAvatarHori">
            <div className="divAvatarHeader">
              <div id="divGender">
                <GenderMaleIcon
                  style={{
                    display: meta?.kid_gender === "male" ? "flex" : "none",
                  }}
                />
                <GenderFemaleIcon
                  style={{
                    display:
                      meta && meta.kid_gender !== "male" ? "flex" : "none",
                  }}
                />
              </div>
              <h1 className="h1sharp" style={{ marginRight: "1em" }}>
                {meta ? (meta.kid_name || "").toUpperCase() : ""}
              </h1>
              <div className="vBar" />
              <h1 className="h1sharp" style={{ marginLeft: "1em" }}>
                {meta && meta.kid_age != null ? `${meta.kid_age} YEARS OLD` : ""}
              </h1>
            </div>
            <div className="divAvatarBody">
              <div className="divAvatarCard">
                {meta?.kid_img_half ? (
                  <img src={meta.kid_img_half} alt="" />
                ) : (
                  <AvatarCardMIcon />
                )}
              </div>
              <div className="divAvatarCardHori">
                {meta?.kid_img_full ? (
                  <img src={meta.kid_img_full} alt="" />
                ) : (
                  <AvatarCardMIcon />
                )}
              </div>
              <div className="divAvatarCard">
                {meta?.companion_img_half ? (
                  <img src={meta.companion_img_half} alt="" />
                ) : (
                  <AvatarCardMIcon />
                )}
              </div>
              <div className="divAvatarCardHori">
                {meta?.companion_img_full ? (
                  <img src={meta.companion_img_full} alt="" />
                ) : (
                  <AvatarCardMIcon />
                )}
              </div>
            </div>
          </div>
          <div className="divAvatarHori">
            <div className="divAvatarHeader">
              <h1 className="h1sharp" style={{ marginLeft: "1.5em" }}>
                PAGE REFERENCE
              </h1>
            </div>
            <div className="divAvatarBody">
              {referenceSrc && (
                <img className="pageReference" src={referenceSrc} alt="" />
              )}
            </div>
          </div>
        </div>
      </div>

      <footer>
        <div
          style={{ width: "33.33%", height: "100%", display: "flex", margin: "auto" }}
        >
          <div
            id="divSettings"
            className="wrapperFooter"
            style={{
              width: settingsOpen ? "415px" : undefined,
              borderColor: settingsOpen ? "var(--theme-med)" : undefined,
              paddingRight: settingsOpen ? "1em" : undefined,
            }}
          >
            <div id="btnSettings" onClick={() => setSettingsOpen((s) => !s)}>
              <span
                style={{
                  margin: "auto",
                  display: "flex",
                  transition: "transform 0.3s",
                  transform: settingsOpen ? "rotate(180deg)" : "rotate(0deg)",
                }}
              >
                <SettingsGearIcon />
              </span>
            </div>
            <div className="vBar" />
            <div style={{ minWidth: "430px", display: "flex" }}>
              <div
                className="optSettings"
                onClick={() => setFillerPages((v) => !v)}
              >
                <div
                  className="chkSettings"
                  id="chkFillerPages"
                  style={{
                    background: fillerPages
                      ? "var(--theme-light-color)"
                      : "var(--bg)",
                  }}
                >
                  {fillerPages && (
                    <h1 className="h1sharp" style={{ margin: "auto" }}>
                      ✔
                    </h1>
                  )}
                </div>
                <h1 className="h1muted">FILLER PAGES</h1>
              </div>
              <div
                className="optSettings"
                onClick={() => setTextPages((v) => !v)}
              >
                <div
                  className="chkSettings"
                  id="chkTextPages"
                  style={{
                    background: textPages
                      ? "var(--theme-light-color)"
                      : "var(--bg)",
                  }}
                >
                  {textPages && (
                    <h1 className="h1sharp" style={{ margin: "auto" }}>
                      ✔
                    </h1>
                  )}
                </div>
                <h1 className="h1muted">TEXT PAGES</h1>
              </div>
              <div
                className="optSettings"
                style={{ marginRight: "1em" }}
                onClick={() => setHotkeysOn((v) => !v)}
              >
                <div
                  className="chkSettings"
                  id="chkHotkeys"
                  style={{
                    background: hotkeysOn
                      ? "var(--theme-light-color)"
                      : "var(--bg)",
                  }}
                >
                  {hotkeysOn && (
                    <h1 className="h1sharp" style={{ margin: "auto" }}>
                      ✔
                    </h1>
                  )}
                </div>
                <h1 className="h1muted">HOTKEYS</h1>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{ width: "33.33%", height: "100%", display: "flex", margin: "auto" }}
        >
          <div
            id="dropPages"
            className="wrapperFooter"
            onClick={() => setDropdownOpen((d) => !d)}
          >
            <div
              id="btnStar"
              data-fav={isFav(currPage) ? "true" : "false"}
              onClick={(e) => {
                e.stopPropagation();
                updateFavorites();
              }}
            >
              <StarIcon fill={isFav(currPage) ? "#FFE100" : "#333333"} />
            </div>
            <h1 className="h1sharp" id="valPage">
              {currPage === 0 ? "COVER PAGE" : `PAGE ${currPage}`}
            </h1>
            <div id="divDrop">
              <DropdownChevronIcon />
            </div>
            <div
              id="dropdown"
              style={{ visibility: dropdownOpen ? "visible" : "hidden" }}
            >
              {ready &&
                Array.from({ length: maxPages + 1 }, (_, a) => {
                  const hidden = isFiller(a);
                  return (
                    <div
                      key={a}
                      className={`optPages${isFav(a) ? " fav" : ""}`}
                      data-pagetype={a >= 1 ? pageTypes[a - 1] : undefined}
                      style={{ display: hidden ? "none" : undefined }}
                      onClick={(e) => {
                        e.stopPropagation();
                        goToPage(a);
                        setDropdownOpen(false);
                      }}
                    >
                      <div className="contStar">
                        <StarIcon fill={isFav(a) ? "#FFE100" : "#333333"} />
                      </div>
                      <h1 className="h1muted">
                        {a === 0 ? "COVER PAGE" : `PAGE ${a}`}
                      </h1>
                      <div style={{ width: "20px", height: "100%" }} />
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        <div
          style={{ width: "33.33%", height: "100%", display: "flex", margin: "auto" }}
        >
          <div id="divTools" className="wrapperFooter">
            <div
              id="btnZoom"
              className={`btnTools${zoomOn ? " active" : ""}`}
              style={{ borderTopLeftRadius: 999, borderBottomLeftRadius: 999 }}
              onClick={toggleZoom}
            >
              <ZoomIcon />
              <div className={hotkeyClass}>
                <h1 className="h1sharp">~</h1>
              </div>
            </div>
            <div
              id="btnAvatar"
              className={`btnTools${avatarOn ? " active" : ""}`}
              onClick={toggleAvatar}
            >
              <AvatarToolIcon />
              <div className={hotkeyClass}>
                <h1 className="h1sharp">A</h1>
              </div>
            </div>
            <div id="btnShade" className="btnTools" onClick={toggleShade}>
              <ShadeIcon />
              <div className={hotkeyClass}>
                <h1 className="h1sharp">S</h1>
              </div>
            </div>
            <div id="btnDownload" className="btnTools" onClick={downloadImage}>
              <DownloadIcon />
              <div className={hotkeyClass}>
                <h1 className="h1sharp">D</h1>
              </div>
            </div>
            <div id="btnUpload" className="btnTools" onClick={uploadImage}>
              <UploadIcon />
              <div className={hotkeyClass}>
                <h1 className="h1sharp">F</h1>
              </div>
            </div>
            <div id="btnReset" className="btnTools" onClick={resetImage}>
              <ResetIcon />
              <div className={hotkeyClass}>
                <h1 className="h1sharp">R</h1>
              </div>
            </div>
            <div id="btnApprove" className="btnTools" onClick={approve}>
              <div>
                <ApproveIcon />
                <h1 className="h1sharp">APPROVE</h1>
              </div>
              <div
                className={hotkeyClass}
                style={{ paddingLeft: 8, paddingRight: 8, top: "-95%" }}
              >
                <h1 className="h1sharp">Ctrl + Enter</h1>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {(loading || loadError) && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 5,
            pointerEvents: "none",
          }}
        >
          <h1 className="h1muted">{loadError ? loadError : "Loading…"}</h1>
        </div>
      )}
    </>
  );
}
