import io
import html
from datetime import datetime, timezone, timedelta
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether, PageBreak
from reportlab.lib.enums import TA_CENTER
import os
from reportlab.platypus import Image
from reportlab.lib.units import inch

def generate_pdf_report(cand_data: dict, reference_text: str, typed_tokens_html: str) -> io.BytesIO:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        rightMargin=40, leftMargin=40,
        topMargin=15, bottomMargin=30
    )
    
    styles = getSampleStyleSheet()
    
    times_normal = ParagraphStyle(
        "TimesNormal",
        parent=styles["Normal"],
        fontName="Times-Roman",
        fontSize=11,
        leading=14
    )
    
    title_style = ParagraphStyle(
        "TitleStyle",
        parent=times_normal,
        alignment=TA_CENTER,
        fontName="Times-Bold",
        fontSize=11,
        leading=13
    )

    elements = []
    
    # 1. Top Header with Logo
    logo_path = os.path.join(os.getcwd(), "frontend", "public", "logo.png")
    logo_img = None
    if os.path.exists(logo_path):
        logo_img = Image(logo_path, width=0.7*inch, height=0.7*inch)
    else:
        logo_img = ""
        
    title_text = (
        "<b>Government of Puducherry</b><br/>"
        "<b>Puducherry Examining Authority</b><br/>"
        "<b>Combined Higher Secondary Level Exam 2025</b><br/>"
        "<b>Recruitment to the Post of Lower Division Clerk</b>"
    )
    p_title = Paragraph(title_text, title_style)
    
    t_header = Table([[logo_img, p_title, ""]], colWidths=[1.0*inch, 5.0*inch, 1.0*inch])
    t_header.setStyle(TableStyle([
        ('ALIGN', (0, 0), (0, 0), 'LEFT'),
        ('VALIGN', (0, 0), (0, 0), 'TOP'),
        ('ALIGN', (1, 0), (1, 0), 'CENTER'),
        ('VALIGN', (1, 0), (1, 0), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    elements.append(t_header)
    
    # Printed On
    ist_now = datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)
    printed_on = ist_now.strftime("%d/%m/%Y %I:%M:%S %p")
    p_printed = Paragraph(f"Printed On : {printed_on}", ParagraphStyle("Right", parent=times_normal, alignment=2, fontSize=9))
    elements.append(p_printed)
    elements.append(Spacer(1, 2))
    
    # 2. Candidate Details Table
    exam_date = cand_data.get("start_date", "")
    batch_shift = cand_data.get("batch") or cand_data.get("batch_name", "")
    ip_addr = cand_data.get("system_ip", "")
    start_dt = cand_data.get("start_time", "")
    submit_dt = cand_data.get("submitted_at", "")
    total_time = cand_data.get("total_time_used", "")
    
    r1c1 = Paragraph(f"Candidate's Name : {cand_data.get('name', '')}", times_normal)
    r1c2 = Paragraph(f"Roll No : {cand_data.get('register_number', '')}", times_normal)
    
    r2c1 = Paragraph(f"Date of Exam : {exam_date}", times_normal)
    r2c2 = Paragraph(f"Batch/Shift : {batch_shift}", times_normal)
    r2c3 = Paragraph(f"IP :- {ip_addr}", times_normal)
    
    r3c1 = Paragraph(f"Total Time Used :<br/>{total_time}", times_normal)
    r3c2 = Paragraph(f"Exam Start Time :<br/>{start_dt}", times_normal)
    r3c3 = Paragraph(f"Submitted Time :<br/>{submit_dt}", times_normal)
    
    r4c1 = Paragraph("Name of Exam : Typing Speed Test on Computer for the Post of Lower Division Clerk", times_normal)
    
    r5c1 = Paragraph("Center Name : Puducherry Technological University", times_normal)
    lab_name = cand_data.get("lab_name", "")
    r5c3 = Paragraph(f"Lab : {lab_name}", times_normal)
    
    t_cand_data = [
        [r1c1, "", r1c2],
        [r2c1, r2c2, r2c3],
        [r3c1, r3c2, r3c3],
        [r4c1, "", ""],
        [r5c1, "", r5c3]
    ]
    
    col_w = 515.27 / 3.0
    t_cand = Table(t_cand_data, colWidths=[col_w, col_w, col_w])
    t_cand.setStyle(TableStyle([
        ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
        ('SPAN', (0, 0), (1, 0)),
        ('SPAN', (0, 3), (2, 3)),
        ('SPAN', (0, 4), (1, 4)),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    elements.append(t_cand)
    elements.append(Spacer(1, 15))

    # 3. Reference Paragraph
    elements.append(Paragraph("<b>Reference Paragraph</b>", ParagraphStyle("CenterBold", parent=times_normal, alignment=TA_CENTER, fontName="Times-Bold", fontSize=14)))
    elements.append(Spacer(1, 10))
    p_ref = Paragraph(reference_text.replace('\n', '<br/>'), ParagraphStyle("Justify", parent=times_normal, alignment=4, fontSize=11, leading=15))
    elements.append(p_ref)
    elements.append(Spacer(1, 15))
    
    # 4. Candidate Typed Paragraph
    p_typed_title = Paragraph("<b>Candidate Typed Paragraph</b>", ParagraphStyle("CenterBold", parent=times_normal, alignment=TA_CENTER, fontName="Times-Bold", fontSize=14))
    p_typed = Paragraph(typed_tokens_html.replace('\n', '<br/>'), ParagraphStyle("Justify", parent=times_normal, alignment=4, fontSize=11, leading=15))
    elements.append(KeepTogether([p_typed_title, Spacer(1, 10), p_typed]))
    elements.append(Spacer(1, 15))

    # 5. Results Summary Table
    elements.append(Paragraph("<b>Results Summary</b>", ParagraphStyle("CenterBold", parent=times_normal, alignment=TA_CENTER, fontName="Times-Bold", fontSize=14)))
    elements.append(Spacer(1, 10))
    
    # Extract and deduplicate error lists to ensure 100% consistency across summary table and error analysis
    wrong_words_list = cand_data.get("wrong_words_list", []) or cand_data.get("full_mistakes_list", [])
    missed_words_list = cand_data.get("missed_words_list", [])
    full_mistakes_list = cand_data.get("full_mistakes_list", []) or wrong_words_list
    half_mistakes_list = cand_data.get("half_mistakes_list", [])
    
    diff_tokens = cand_data.get("diff_tokens", [])
    if diff_tokens and not (wrong_words_list or missed_words_list or half_mistakes_list):
        full_mistakes_list = []
        half_mistakes_list = []
        missed_words_list = []
        seen_missed_indices = set()
        for idx, t in enumerate(diff_tokens):
            if not isinstance(t, dict):
                continue
            status = t.get("status")
            err_type = t.get("error_type")
            ref_val = t.get("ref")
            typed_val = t.get("typed")

            if err_type == "omission" or (status in ["full_error", "not_typed"] and typed_val is None and ref_val and str(ref_val) not in [".", ","]):
                if idx not in seen_missed_indices and ref_val:
                    missed_words_list.append(str(ref_val))
                    seen_missed_indices.add(idx)
            elif status == "half_error":
                if idx not in seen_missed_indices:
                    val = typed_val if typed_val else ref_val
                    if val and str(val) not in [".", ","]:
                        half_mistakes_list.append(str(val))
            elif status == "full_error" and typed_val is not None:
                if idx not in seen_missed_indices:
                    if str(typed_val) not in [".", ","]:
                        full_mistakes_list.append(str(typed_val))
        wrong_words_list = full_mistakes_list

    def _dedup_seq(seq):
        seen_items = set()
        return [html.escape(str(x)) for x in seq if not (x in seen_items or seen_items.add(x))]

    wrong_words_list = _dedup_seq(wrong_words_list)
    full_mistakes_list = _dedup_seq(full_mistakes_list or wrong_words_list)
    missed_words_list = _dedup_seq(missed_words_list)
    half_mistakes_list = _dedup_seq(half_mistakes_list)

    words_typed = str(cand_data.get("word_count", 0))
    missed_val = len(missed_words_list)
    missed_count = str(missed_val)
    wrong_val = len(full_mistakes_list)
    wrong_count = str(wrong_val)
    full_mis_val = missed_val + wrong_val
    full_mis = str(full_mis_val)
    # Use the raw accumulated half_mistakes counter from the evaluator.
    # This correctly counts n_half=2 for a 3-word merge as 2 half mistakes.
    # Fall back to len(half_mistakes_list) only when raw counter is unavailable.
    raw_half = cand_data.get("half_mistakes")
    half_mis_val = int(raw_half) if raw_half is not None else len(half_mistakes_list)
    half_mis = str(half_mis_val)
    
    tot_mis_val = round(full_mis_val + (half_mis_val * 0.5), 1)
    tot_mis = str(tot_mis_val)
    
    total_ref = len([w for w in (reference_text or '').split() if w.strip()])
    err_pct_val = (tot_mis_val / total_ref * 100) if total_ref > 0 else 0.0
    err_pct_val = min(100.0, err_pct_val)
    err_pct = f"{err_pct_val:.2f}%"
    
    wpm_val = cand_data.get("wpm", 0.0)
    wpm_str = str(int(wpm_val))
    
    error_threshold = round(0.15 * total_ref, 1) if total_ref > 0 else 1.0
    is_pass = (tot_mis_val <= error_threshold)
    res_str = "Qualified" if is_pass else "Not Qualified"
    
    h1 = Paragraph("<b>Words Typed</b>", ParagraphStyle("C", parent=times_normal, alignment=TA_CENTER, fontSize=8.5, leading=11))
    h_miss = Paragraph("<b>Missing Words<br/>(A)</b>", ParagraphStyle("C", parent=times_normal, alignment=TA_CENTER, fontSize=8.5, leading=11))
    h_wrong = Paragraph("<b>Wrong Words<br/>(B)</b>", ParagraphStyle("C", parent=times_normal, alignment=TA_CENTER, fontSize=8.5, leading=11))
    h2 = Paragraph("<b>Full Mistakes<br/>(A+B)</b>", ParagraphStyle("C", parent=times_normal, alignment=TA_CENTER, fontSize=8.5, leading=11))
    h3 = Paragraph("<b>Half Mistakes<br/>(C)</b>", ParagraphStyle("C", parent=times_normal, alignment=TA_CENTER, fontSize=8.5, leading=11))
    h4 = Paragraph("<b>Total Mistakes<br/>((A+B) + C/2)</b>", ParagraphStyle("C", parent=times_normal, alignment=TA_CENTER, fontSize=8.5, leading=11))
    h_err = Paragraph("<b>Error %</b>", ParagraphStyle("C", parent=times_normal, alignment=TA_CENTER, fontSize=8.5, leading=11))
    h_wpm = Paragraph("<b>WPM</b>", ParagraphStyle("C", parent=times_normal, alignment=TA_CENTER, fontSize=8.5, leading=11))
    h5 = Paragraph("<b>Result</b>", ParagraphStyle("C", parent=times_normal, alignment=TA_CENTER, fontSize=8.5, leading=11))
    
    v1 = Paragraph(words_typed, ParagraphStyle("C", parent=times_normal, alignment=TA_CENTER, fontSize=10))
    v_miss = Paragraph(missed_count, ParagraphStyle("C", parent=times_normal, alignment=TA_CENTER, fontSize=10))
    v_wrong = Paragraph(wrong_count, ParagraphStyle("C", parent=times_normal, alignment=TA_CENTER, fontSize=10))
    v2 = Paragraph(full_mis, ParagraphStyle("C", parent=times_normal, alignment=TA_CENTER, fontSize=10))
    v3 = Paragraph(half_mis, ParagraphStyle("C", parent=times_normal, alignment=TA_CENTER, fontSize=10))
    v4 = Paragraph(tot_mis, ParagraphStyle("C", parent=times_normal, alignment=TA_CENTER, fontSize=10))
    v_err = Paragraph(err_pct, ParagraphStyle("C", parent=times_normal, alignment=TA_CENTER, fontSize=10))
    v_wpm = Paragraph(wpm_str, ParagraphStyle("C", parent=times_normal, alignment=TA_CENTER, fontSize=10))
    v5 = Paragraph(f"<b>{res_str}</b>", ParagraphStyle("C", parent=times_normal, alignment=TA_CENTER, fontSize=9))
    
    res_data = [
        [h1, h_miss, h_wrong, h2, h3, h4, h_err, h_wpm, h5],
        [v1, v_miss, v_wrong, v2, v3, v4, v_err, v_wpm, v5]
    ]
    
    res_col_w = 515.27 / 9.0
    t_res = Table(res_data, colWidths=[res_col_w]*9)
    t_res.setStyle(TableStyle([
        ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(t_res)
    elements.append(Spacer(1, 30))
    
    # 7. Signatures
    name = cand_data.get("name", "")
    roll = cand_data.get("register_number", "")
    
    sig_name = Paragraph(f"{name} ( {roll} )", ParagraphStyle("Center", parent=times_normal, alignment=TA_CENTER))
    c_sig = Paragraph("Candidate's Signature", ParagraphStyle("Center", parent=times_normal, alignment=TA_CENTER))
    i_sig = Paragraph("Invigilator's Signature", ParagraphStyle("Center", parent=times_normal, alignment=TA_CENTER))
    
    sig_data = [
        [sig_name, ""],
        [c_sig, i_sig]
    ]
    t_sig = Table(sig_data, colWidths=[3.45*inch, 3.45*inch])
    t_sig.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'BOTTOM'),
        ('TOPPADDING', (0, 1), (-1, 1), 3),
    ]))
    
    elements.append(t_sig)
    
    # 8. Error Breakdown Page (New Page)
    elements.append(PageBreak())
    elements.append(Paragraph("<b>Error Analysis</b>", ParagraphStyle("CenterBold2", parent=times_normal, alignment=TA_CENTER, fontName="Times-Bold", fontSize=14)))
    elements.append(Spacer(1, 10))
    elements.append(Paragraph(f"<b>Candidate Name : {name} ( {roll} )</b>", ParagraphStyle("CenterSub2", parent=times_normal, alignment=TA_CENTER, fontSize=11)))
    elements.append(Spacer(1, 15))

    section_style = ParagraphStyle("SectionHead", parent=times_normal, fontName="Times-Bold", fontSize=12, leading=16)
    word_list_style = ParagraphStyle("WordList", parent=times_normal, fontSize=11, leading=15, alignment=4)

    # 1. Full Mistake
    elements.append(Paragraph("<b>1. Full Mistake</b>", section_style))
    elements.append(Spacer(1, 6))
    f_text = ", ".join(full_mistakes_list) if full_mistakes_list else "None"
    elements.append(Paragraph(f_text, word_list_style))
    elements.append(Spacer(1, 15))

    # 2. Half mistake
    elements.append(Paragraph("<b>2. Half mistake</b>", section_style))
    elements.append(Spacer(1, 6))
    h_text = ", ".join(half_mistakes_list) if half_mistakes_list else "None"
    elements.append(Paragraph(h_text, word_list_style))
    elements.append(Spacer(1, 15))

    # 3. Missed words
    elements.append(Paragraph("<b>3. Missed words</b>", section_style))
    elements.append(Spacer(1, 6))
    m_text = ", ".join(missed_words_list) if missed_words_list else "None"
    elements.append(Paragraph(m_text, word_list_style))
    elements.append(Spacer(1, 35))

    note_style = ParagraphStyle("NoteStyle", parent=times_normal, fontSize=10.5, leading=15, alignment=4)
    note_text = (
        "<b>Note :</b><br/>"
        "The missed punctuation errors, if any, is not shown in candidate typed paragraph. "
        "The candidate can cross check the reference paragraph for missed punctuation errors only. "
        "Substituted or newly added punctuation errors, if any, is underlined in the candidate typed paragraph."
    )
    elements.append(Paragraph(note_text, note_style))
    elements.append(Spacer(1, 20))

    doc.build(elements)
    buffer.seek(0)
    return buffer
