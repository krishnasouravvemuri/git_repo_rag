from rest_framework.response import Response

class ApiResponse:
    def __init__(self, response_data = None , status_code = 200 , message = ""):
        self.response_data = response_data
        self.status_code = status_code
        self.message = message

    def build(self):
        return Response(
            {
                "meta": {
                    "code": self.status_code,
                    "message": self.message
                },
                "data": self.response_data
            },
            status=self.status_code
        )
