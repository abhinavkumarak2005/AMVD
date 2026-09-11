import os
from datetime import datetime
from reportlab.lib.pagesizes import A5
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

def generate_receipt_pdf(receipt_data: dict) -> str:
    """
    Generates a beautiful PDF receipt for Temple Bookings or Donations.
    Returns the absolute path to the generated PDF.
    """
    # Create temp directory if it doesn't exist
    temp_dir = os.path.join(os.getcwd(), "temp_receipts")
    os.makedirs(temp_dir, exist_ok=True)
    
    filename = f"Receipt_{receipt_data.get('receipt_no', 'unknown')}.pdf"
    filepath = os.path.join(temp_dir, filename)
    
    doc = SimpleDocTemplate(
        filepath,
        pagesize=A5,
        rightMargin=30,
        leftMargin=30,
        topMargin=30,
        bottomMargin=30
    )
    
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'TitleStyle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=16,
        textColor=colors.HexColor('#8B4513'), # Temple Brown
        alignment=1, # Center
        spaceAfter=5
    )
    
    subtitle_style = ParagraphStyle(
        'SubtitleStyle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        textColor=colors.HexColor('#D4AF37'), # Temple Gold
        alignment=1,
        spaceAfter=20
    )
    
    normal_style = styles['Normal']
    
    elements = []
    
    # 1. Header
    elements.append(Paragraph("Sri Manakula Vinayagar Devasthanam", title_style))
    elements.append(Paragraph("Puducherry - 605001", subtitle_style))
    elements.append(Spacer(1, 10))
    
    # 2. Receipt Title
    receipt_title = "DONATION RECEIPT" if receipt_data.get('type') == 'E-Undiyal Donation' else "BOOKING RECEIPT"
    elements.append(Paragraph(f"<b>{receipt_title}</b>", ParagraphStyle('RT', parent=styles['Normal'], alignment=1, fontSize=12)))
    elements.append(Spacer(1, 20))
    
    # 3. Details Table
    data = [
        ["Receipt No:", receipt_data.get('receipt_no', 'N/A')],
        ["Date:", datetime.now().strftime("%B %d, %Y")],
        ["Devotee Name:", receipt_data.get('name', 'N/A')],
        ["Purpose:", receipt_data.get('details', 'N/A')],
        ["Amount:", f"Rs. {receipt_data.get('amount', 0)}"],
    ]
    
    t = Table(data, colWidths=[2 * inch, 2.5 * inch])
    t.setStyle(TableStyle([
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#8B4513')),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LINEBELOW', (0, -1), (-1, -1), 1, colors.HexColor('#D4AF37')),
    ]))
    
    elements.append(t)
    elements.append(Spacer(1, 40))
    
    # 4. Footer Message
    elements.append(Paragraph("<i>May Lord Ganesha shower His blessings upon you!</i>", ParagraphStyle('FT', parent=styles['Normal'], alignment=1, textColor=colors.HexColor('#8B4513'))))
    
    
    doc.build(elements)
    
    return filepath

def generate_report_pdf(title: str, headers: list, rows: list) -> str:
    """
    Generates a tabular PDF report.
    Returns the absolute path to the generated PDF.
    """
    temp_dir = os.path.join(os.getcwd(), "temp_reports")
    os.makedirs(temp_dir, exist_ok=True)
    
    filename = f"Report_{datetime.now().strftime('%Y%m%d%H%M%S')}.pdf"
    filepath = os.path.join(temp_dir, filename)
    
    # Use portrait A4 for reports
    from reportlab.lib.pagesizes import A4
    doc = SimpleDocTemplate(
        filepath,
        pagesize=A4,
        rightMargin=30,
        leftMargin=30,
        topMargin=30,
        bottomMargin=30
    )
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'TitleStyle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=16,
        textColor=colors.HexColor('#8B4513'),
        alignment=1,
        spaceAfter=20
    )
    
    elements = []
    
    # 1. Header
    elements.append(Paragraph(title, title_style))
    elements.append(Paragraph(f"Generated on {datetime.now().strftime('%B %d, %Y')}", styles['Normal']))
    elements.append(Spacer(1, 20))
    
    # 2. Table
    # Combine headers and rows
    data = [headers] + rows
    
    t = Table(data)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#D4AF37')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
        ('ALIGN', (0, 1), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 10),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    
    elements.append(t)
    doc.build(elements)
    
    return filepath
