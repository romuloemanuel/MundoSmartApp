namespace MundoSmart.BlingAssistencia.API.Models.Bling;

public class BlingTokenResponse
{
    public string AccessToken { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
    public int ExpiresIn { get; set; }
    public string TokenType { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
}
