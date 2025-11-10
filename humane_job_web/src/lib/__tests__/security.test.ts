import {
  sanitizeHtml,
  sanitizeInput,
  sanitizeEmail,
  sanitizeFileName,
  sanitizeUrl,
  detectInjection,
} from "../security/sanitize";

describe("Security Sanitization", () => {
  describe("sanitizeHtml", () => {
    it("should remove script tags", () => {
      const input = '<script>alert("XSS")</script><p>Hello</p>';
      const result = sanitizeHtml(input);
      expect(result).not.toContain("<script>");
      expect(result).toContain("<p>Hello</p>");
    });

    it("should allow safe HTML tags", () => {
      const input = "<p>Hello <strong>World</strong></p>";
      const result = sanitizeHtml(input);
      expect(result).toBe("<p>Hello <strong>World</strong></p>");
    });

    it("should remove event handlers", () => {
      const input = '<a href="#" onclick="alert(1)">Click</a>';
      const result = sanitizeHtml(input);
      expect(result).not.toContain("onclick");
    });
  });

  describe("sanitizeInput", () => {
    it("should remove angle brackets", () => {
      const input = "<script>alert(1)</script>";
      const result = sanitizeInput(input);
      expect(result).not.toContain("<");
      expect(result).not.toContain(">");
    });

    it("should remove javascript protocol", () => {
      const input = "javascript:alert(1)";
      const result = sanitizeInput(input);
      expect(result).not.toContain("javascript:");
    });

    it("should trim whitespace", () => {
      const input = "  hello  ";
      const result = sanitizeInput(input);
      expect(result).toBe("hello");
    });
  });

  describe("sanitizeEmail", () => {
    it("should convert to lowercase", () => {
      expect(sanitizeEmail("Test@Example.COM")).toBe("test@example.com");
    });

    it("should trim whitespace", () => {
      expect(sanitizeEmail("  test@example.com  ")).toBe("test@example.com");
    });
  });

  describe("sanitizeFileName", () => {
    it("should replace invalid characters", () => {
      const input = "my<file>name.txt";
      const result = sanitizeFileName(input);
      expect(result).not.toContain("<");
      expect(result).not.toContain(">");
      expect(result).toContain(".txt");
    });

    it("should handle path traversal attempts", () => {
      const input = "../../../etc/passwd";
      const result = sanitizeFileName(input);
      expect(result).not.toContain("../");
    });

    it("should limit length", () => {
      const input = "a".repeat(300);
      const result = sanitizeFileName(input);
      expect(result.length).toBeLessThanOrEqual(255);
    });
  });

  describe("sanitizeUrl", () => {
    it("should allow valid HTTP URLs", () => {
      const url = "https://example.com/page";
      const result = sanitizeUrl(url);
      expect(result).toBe(url);
    });

    it("should reject javascript protocol", () => {
      const url = "javascript:alert(1)";
      const result = sanitizeUrl(url);
      expect(result).toBe("");
    });

    it("should reject data URLs", () => {
      const url = "data:text/html,<script>alert(1)</script>";
      const result = sanitizeUrl(url);
      expect(result).toBe("");
    });

    it("should handle invalid URLs", () => {
      const url = "not a url";
      const result = sanitizeUrl(url);
      expect(result).toBe("");
    });
  });

  describe("detectInjection", () => {
    it("should detect XSS attempts", () => {
      const result = detectInjection('<script>alert("XSS")</script>');
      expect(result.safe).toBe(false);
      expect(result.threats).toContain("XSS - script tag");
    });

    it("should detect SQL injection", () => {
      const result = detectInjection("1' OR '1'='1");
      expect(result.safe).toBe(false);
      expect(result.threats.length).toBeGreaterThan(0);
    });

    it("should detect path traversal", () => {
      const result = detectInjection("../../../etc/passwd");
      expect(result.safe).toBe(false);
      expect(result.threats).toContain("Path traversal");
    });

    it("should pass safe input", () => {
      const result = detectInjection("Hello, this is a normal string!");
      expect(result.safe).toBe(true);
      expect(result.threats).toHaveLength(0);
    });
  });
});
